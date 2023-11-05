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
import {cartesian, permute} from "../array"

type EachIteratee<U extends Component.T[]> = (
  entity: Entity.T,
  ...values: Component.ValuesOf<U>
) => void

type EachArgs<U extends Component.T[]> = [
  ...relatives: Component.Related<U>,
  iteratee: EachIteratee<U>,
]
type Each<U extends Component.T[]> = (...args: EachArgs<U>) => void

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
  not
  relationship_matches
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
    const relationship_matches = [] as Entity.T[][][]
    const {changed, not} = initialize_filters(filters, world)
    this.changed = changed
    this.is_monitor = is_monitor
    this.matches = matches
    this.node = Graph.resolve(world.graph, type)
    this.not = not
    this.relationship_matches = relationship_matches
    this.type = type
    this.#each =
      type.sparse_relations.length > 0
        ? compile_each_iterator_with_relationships(
            world,
            type,
            relationship_matches,
            changed,
          )
        : compile_each_iterator(world, type, SparseMap.values(matches), changed)
  }

  each(
    ...args: [...relatives: Component.Related<U>, iteratee: EachIteratee<U>]
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
      forget_node(this, this.node)
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
      s += `W[((${id}&${Entity.HI})<<${Entity.LO_EXTENT})|p${id}][e],`
    }
  }
  return s.slice(0, s.length - 1)
}

const make_iterator_params_expression = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.relations.length; i++) {
    const relation = type.relations[i]
    s += `p${relation.id},`
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
  for (let i = 0; i < type.relations.length; i++) {
    const relation = type.relations[i]
    s += `h=Math.imul((h<<5)^(p${relation.id}|0),0x9e3779b9);`
  }
  s += "const M=R[h];"
  return s
}

const make_common_expressions = (
  type: Type.T,
  changed: Query["changed"],
  stores: SparseMap.SparseMap<unknown[]>,
) => {
  const filter = make_iterator_filter_predicate_expression(changed)
  const fetch = make_iterator_iteratee_args_expression(type)
  const args = make_iterator_params_expression(type)
  const body =
    make_store_declarations(stores) + make_changed_declarations(changed)
  return {filter, fetch, args, body}
}

const compile_each_iterator_with_relationships = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  relationship_matches: Entity.T[][][],
  changed: Query["changed"],
): Each<U> => {
  const changed_predicates = changed.map(changed => changed.predicate)
  const stores = get_value_stores(type, world)
  const stores_sparse = SparseMap.to_sparse_array(stores)
  const exps = make_common_expressions(type, changed, stores)
  let body = exps.body
  body += `return function each_iterator(${exps.args}$){`
  body += make_relation_matches_declaration(type)
  body += "if(M===undefined)return;"
  body += make_iterator_iterator(exps.fetch, exps.filter)
  body += "}"
  const closure = Function("S", "C", "R", "W", body)
  return closure(
    stores_sparse,
    changed_predicates,
    relationship_matches,
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
  body += `return function each_iterator(${exps.args}$){`
  body += make_iterator_iterator(exps.fetch, exps.filter)
  body += "}"
  const closure = Function("S", "C", "M", body)
  return closure(stores_sparse, changed_predicates, matches)
}

const make_relationship_paths = (query_type: Type.T, node_type: Type.T) => {
  const relation_arites: number[] = []
  const relation_order: number[] = []
  const entity_subpaths: number[][] = []
  for (let i = 0; i < query_type.relations.length; i++) {
    const relation = query_type.relations[i]
    relation_arites[relation.id] =
      relation_arites[relation.id] === undefined
        ? 1
        : relation_arites[relation.id] + 1
    if (!relation_order.includes(relation.id)) {
      relation_order.push(relation.id)
    }
    for (let j = 0; j < node_type.relationships.length; j++) {
      const relationship = node_type.relationships[j]
      const relationship_component_id = Entity.parse_hi(relationship.id)
      if (relation.id === relationship_component_id) {
        const path = (entity_subpaths[i] ??= [])
        path.push(Entity.parse_entity_id(relationship.id))
      }
    }
  }
  const entity_path_permutations: number[][][] = []
  for (let i = 0; i < entity_subpaths.length; i++) {
    const subpath = entity_subpaths[i]
    const subpath_permutation = permute(
      subpath,
      relation_arites[relation_order[i]],
    )
    entity_path_permutations.push(subpath_permutation)
  }
  const entity_path_permutations_product = cartesian(entity_path_permutations)
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
  if (Type.has_relations(query.type)) {
    const entity_hashes = make_relationship_paths(query.type, node.type)
    for (let i = 0; i < entity_hashes.length; i++) {
      const entity_hash = entity_hashes[i]
      const entity_matches = (query.relationship_matches[entity_hash] ??= [])
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
    const entity_hashes = make_relationship_paths(query.type, node.type)
    for (let i = 0; i < entity_hashes.length; i++) {
      const entity_hash = entity_hashes[i]
      query.relationship_matches[entity_hash] = undefined!
    }
  }
  SparseMap.delete(query.matches, node.type.hash)
}

const initialize_filters = (filters: Filter.T[], world: World.T) => {
  const changed: QueryChangedRecord[] = []
  const not: Filter.T[] = []
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i]
    switch (filter.kind) {
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
    }
  }
  return {changed, not}
}

const init_monitor_graph_listeners = (query: Query, filters: Filter.T[]) => {
  for (let i = 0; i < filters.length; i++) {
    const {kind} = filters[i]
    switch (kind) {
      case Filter.Kind.In:
      case Filter.Kind.Out:
        Signal.subscribe(
          kind === Filter.Kind.In ? query.node.$included : query.node.$excluded,
          function on_entities_included_or_excluded(event) {
            remember_node(query, query.node, event.entities)
          },
        )
        break
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

if (import.meta.vitest) {
  const {} = await import("vitest")
}
