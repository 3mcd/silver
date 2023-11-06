import * as Component from "../data/component"
import * as Hash from "../hash"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Graph from "../world/graph"
import * as World from "../world/world"
import * as Changed from "./changed"
import * as Filter from "./filter"
import * as Transition from "../world/transition"
import {product} from "../array"

type EachIteratee<U extends Component.T[]> = (
  entity: Entity.T,
  ...values: Component.ValuesOf<U>
) => void

type EachArgs<U extends Component.T[]> = [
  ...relatives: Component.Related<U>,
  iteratee: EachIteratee<U>,
]
type Each<U extends Component.T[]> = (...params: EachArgs<U>) => void

class QueryChangedRecord {
  state
  predicate

  constructor(state: Changed.FilterState, predicate: Changed.Predicate) {
    this.state = state
    this.predicate = predicate
  }
}

export class Query<U extends Component.T[] = Component.T[]> {
  #each: Each<U>
  changed
  is_monitor
  matches
  node
  is
  not
  relation_matches
  type

  constructor(world: World.T, type: Type.T<U>, filters: Filter.T[]) {
    let is_monitor = false
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]
      if (filter.kind === Filter.Kind.In || filter.kind === Filter.Kind.Out) {
        is_monitor = true
        break
      }
    }

    const matches = SparseMap.make<Entity.T[]>()
    const relation_matches: Entity.T[][][] = []
    const {changed, is, not} = initialize_filters(filters, world)
    this.changed = changed
    this.is = is
    this.is_monitor = is_monitor
    this.matches = matches
    this.node = Graph.resolve(world.graph, type)
    this.not = not
    this.relation_matches = relation_matches
    this.type = type
    this.#each = Type.has_relations(type)
      ? compile_each_iterator_with_relations(
          world,
          type,
          relation_matches,
          changed,
        )
      : compile_each_iterator(world, type, SparseMap.values(matches), changed)
  }

  each(
    ...params: [...relatives: Component.Related<U>, iteratee: EachIteratee<U>]
  ): void
  each() {
    this.#each.apply(null, arguments as unknown as Parameters<Each<U>>)
    for (let i = 0; i < this.changed.length; i++) {
      const {state} = this.changed[i]
      SparseMap.each(state.stage, (key, version) => {
        state.changes[key] = version
      })
    }
    if (this.is_monitor && SparseMap.size(this.matches) > 0) {
      this.relation_matches = []
      SparseMap.clear(this.matches)
    }
  }
}
export type T<U extends Component.T[] = Component.T[]> = Query<U>

const get_value_stores = (type: Type.T, world: World.T) => {
  const stores = SparseMap.make<unknown[]>()
  for (let i = 0; i < type.components.length; i++) {
    const component = type.components[i]
    if (component.kind === Component.Kind.Value) {
      SparseMap.set(stores, component.id, world.store(component.id))
    }
  }
  return stores
}

const make_iterator_filter_predicate_expression = (
  changed: Query["changed"],
) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `c${i}(e)===false||`
  }
  return s.slice(0, s.length - 2)
}

const make_iterator_iteratee_args_expression = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.component_spec.length; i++) {
    const {id, kind} = type.component_spec[i]
    if (kind === Component.Kind.Value) {
      s += `s${id}[e],`
    } else if (kind === Component.Kind.ValueRelation) {
      s += `W[((${id}&${Entity.HI})<<${Entity.LO_EXTENT})|r${i}][e],`
    }
  }
  return s.slice(0, s.length - 1)
}

const make_iterator_params_expression = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.component_spec.length; i++) {
    if (Component.is_relation(type.component_spec[i])) {
      s += `r${i},`
    }
  }
  return s
}

const make_iterator_iterator = (fetch: string, filter: string) => {
  let s = ""
  s += "for(let i=0;i<M.length;i++){"
  s += "const m=M[i];"
  s += "for(let j=0;j<m.length;j++){"
  s += "const e=m[j];"
  if (filter) {
    s += `if(${filter})continue;`
  }
  s += `$(e,${fetch})`
  s += "}}"
  return s
}

const make_changed_declarations = (changed: Query["changed"]) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `const c${i}=C[${i}];`
  }
  return s
}

const make_store_declarations = (stores: SparseMap.T<unknown[]>) => {
  let s = ""
  SparseMap.each(stores, component_id => {
    s += `const s${component_id}=S[${component_id}];`
  })
  return s
}

const make_relation_matches_declaration = (type: Type.T) => {
  let s = `let h=0;`
  for (let i = 0; i < type.component_spec.length; i++) {
    if (Component.is_relation(type.component_spec[i])) {
      s += `h=Math.imul((h<<5)^(r${i}|0),0x9e3779b9);`
    }
  }
  s += "const M=R[h];"
  return s
}

const make_common_expressions = (
  type: Type.T,
  changed: Query["changed"],
  stores: SparseMap.SparseMap<unknown[]>,
) => {
  const fetch = make_iterator_iteratee_args_expression(type)
  const filter = make_iterator_filter_predicate_expression(changed)
  const params = make_iterator_params_expression(type)
  const body =
    make_store_declarations(stores) + make_changed_declarations(changed)
  return {fetch, filter, params, body}
}

const compile_each_iterator_with_relations = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  relation_matches: Entity.T[][][],
  changed: Query["changed"],
): Each<U> => {
  const changed_predicates = changed.map(changed => changed.predicate)
  const stores = get_value_stores(type, world)
  const stores_sparse = SparseMap.to_sparse_array(stores)
  const exps = make_common_expressions(type, changed, stores)
  let body = exps.body
  body += `return function each_iterator(${exps.params}$){`
  body += make_relation_matches_declaration(type)
  body += "if(M===undefined)return;"
  body += make_iterator_iterator(exps.fetch, exps.filter)
  body += "}"
  const closure = Function("S", "C", "R", "W", body)
  return closure(
    stores_sparse,
    changed_predicates,
    relation_matches,
    world.stores,
  )
}

const compile_each_iterator = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  matches: Entity.T[][],
  changed: Query["changed"],
): Each<U> => {
  const changed_predicates = changed.map(changed => changed.predicate)
  const stores = get_value_stores(type, world)
  const stores_sparse = SparseMap.to_sparse_array(stores)
  const exps = make_common_expressions(type, changed, stores)
  let body = exps.body
  body += `return function each_iterator(${exps.params}$){`
  body += make_iterator_iterator(exps.fetch, exps.filter)
  body += "}"
  const closure = Function("S", "C", "M", body)
  return closure(stores_sparse, changed_predicates, matches)
}

const make_relationship_hashes = (query: T, node_type: Type.T) => {
  const relation_entity_buckets: number[][] = []
  // Extract a list of the node's included relatives for each relation.
  for (let i = 0; i < query.type.relations_spec.length; i++) {
    const relation = query.type.relations_spec[i]
    const relation_entity_bucket = (relation_entity_buckets[i] ??= [])
    for (let j = 0; j < node_type.relationships.length; j++) {
      const relationship = node_type.relationships[j]
      const relationship_component_id = Entity.parse_hi(relationship.id)
      if (relation.id === relationship_component_id) {
        relation_entity_bucket.push(Entity.parse_entity_id(relationship.id))
      }
    }
  }
  // Compute the cartesian product of potential relatives.
  const entity_path_permutations_product = product(relation_entity_buckets)
  // Create an integer key for each permutation for fast lookup.
  const entity_hashes: number[] = []
  for (let i = 0; i < entity_path_permutations_product.length; i++) {
    const flat = entity_path_permutations_product[i].flat(1)
    entity_hashes.push(Hash.words(flat))
  }
  return entity_hashes
}

const remember_node = (
  query: Query,
  node: Graph.Node,
  entities: Entity.T[],
) => {
  for (let i = 0; i < query.not.length; i++) {
    if (Type.has(node.type, query.not[i].type)) {
      return false
    }
  }
  for (let i = 0; i < query.is.length; i++) {
    if (!Type.has(node.type, query.is[i].type)) {
      return false
    }
  }
  if (Type.has_relations(query.type)) {
    const entity_hashes = make_relationship_hashes(query, node.type)
    for (let i = 0; i < entity_hashes.length; i++) {
      const entity_hash = entity_hashes[i]
      const entity_matches = (query.relation_matches[entity_hash] ??= [])
      entity_matches.push(entities)
    }
  }
  if (query.is_monitor) {
    let entity_matches = SparseMap.get(query.matches, node.type.hash)
    if (entity_matches === undefined) {
      entity_matches = []
      SparseMap.set(query.matches, node.type.hash, entity_matches)
    }
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      entity_matches.push(entity)
    }
  } else {
    SparseMap.set(query.matches, node.type.hash, entities)
  }

  return true
}

const forget_node = (query: Query, node: Graph.Node) => {
  if (Type.has_relations(query.type)) {
    const entity_hashes = make_relationship_hashes(query, node.type)
    for (let i = 0; i < entity_hashes.length; i++) {
      const entity_hash = entity_hashes[i]
      query.relation_matches[entity_hash] = undefined!
    }
  }
  SparseMap.delete(query.matches, node.type.hash)
}

const initialize_filters = (filters: Filter.T[], world: World.T) => {
  const changed: QueryChangedRecord[] = []
  const is: Filter.T[] = []
  const not: Filter.T[] = []
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i]
    switch (filter.kind) {
      case Filter.Kind.Is:
        is.push(filter)
        break
      case Filter.Kind.Not:
        not.push(filter)
        break
      case Filter.Kind.Changed: {
        const changed_state = Changed.make_filter_state()
        const changed_predicate = Changed.compile_predicate(
          filter.type,
          world.changes,
          changed_state,
        )
        changed.push(new QueryChangedRecord(changed_state, changed_predicate))
        break
      }
      case Filter.Kind.In:
      case Filter.Kind.Out:
        is.push(Filter.Is(filter.type))
        break
    }
  }
  return {changed, is, not}
}

const init_monitor_graph_listeners = (query: Query, filters: Filter.T[]) => {
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i]
    switch (filter.kind) {
      case Filter.Kind.In:
      case Filter.Kind.Out: {
        const on_transition_event = (event: Transition.Event) => {
          remember_node(query, event.node, event.entities)
        }
        Signal.subscribe(
          filter.kind === Filter.Kind.In
            ? query.node.$included
            : query.node.$excluded,
          on_transition_event,
        )
        if (filter.kind === Filter.Kind.In) {
          Graph.traverse(query.node, node => {
            remember_node(query, node, SparseSet.values(node.entities))
          })
        }
        break
      }
    }
  }
}

const init_query_graph_listeners = (query: Query) => {
  const on_node_created = (node: Graph.Node) => {
    remember_node(query, node, SparseSet.values(node.entities))
  }
  const on_node_removed = (node: Graph.Node) => {
    forget_node(query, node)
  }
  Signal.subscribe(query.node.$created, on_node_created)
  Signal.subscribe(query.node.$removed, on_node_removed)
  Graph.traverse(query.node, on_node_created)
}

export const make = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  filters: Filter.T[],
): Query<U> => {
  const query = new Query(world, type, filters)
  if (query.is_monitor) {
    init_monitor_graph_listeners(query, filters)
  } else {
    init_query_graph_listeners(query)
  }
  return query
}

export const query = <U extends Component.T[]>(
  world: World.T,
  type: Type.Type<U>,
  ...filters: Filter.T[]
): Query<U> => {
  return make(world, type, filters)
}
