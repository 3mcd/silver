import {product} from "../array"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Hash from "../hash"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Graph from "../world/graph"
import * as Transition from "../world/transition"
import * as World from "../world/world"
import * as Changed from "./changed"
import * as Filter from "./filter"

type EachIteratee<U extends Component.T[]> = (
  entity: Entity.T,
  ...values: Component.ValuesOf<U>
) => void

type EachArgs<U extends Component.T[]> = [
  ...relatives: Component.Relatives<U>,
  iteratee: EachIteratee<U>,
]
type Each<U extends Component.T[]> = (...params: EachArgs<U>) => void

class QueryChanged {
  state
  predicate

  constructor(state: Changed.FilterState, predicate: Changed.Predicate) {
    this.state = state
    this.predicate = predicate
  }
}

let make_each_iterator_filter_exp = (changed: QueryChanged[]) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `c${i}(e)===false||`
  }
  return s.slice(0, s.length - 2)
}

let make_each_iterator_fetch_exp = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.component_spec.length; i++) {
    let {id, kind} = type.component_spec[i]
    if (kind === Component.Kind.Value) {
      s += `s${i}[e],`
    } else if (kind === Component.Kind.ValueRelation) {
      s += `W[((${id}&${Entity.HI})<<${Entity.LO_EXTENT})|r${i}][e],`
    }
  }
  return s.slice(0, s.length - 1)
}

let make_each_iterator_params_exp = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.component_spec.length; i++) {
    if (Component.is_relation(type.component_spec[i])) {
      s += `r${i},`
    }
  }
  return s
}

let make_each_iterator_body = (fetch_exp: string, filter: string) => {
  let s = ""
  s += "for(let i=0;i<M.length;i++){"
  s += "let m=M[i];"
  s += "for(let j=0;j<m.length;j++){"
  s += "let e=m[j];"
  if (filter) {
    s += `if(${filter})continue;`
  }
  s += `$(e,${fetch_exp})`
  s += "}}"
  return s
}

let make_changed_declarations = (changed: QueryChanged[]) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `let c${i}=C[${i}];`
  }
  return s
}

let make_store_declarations = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.component_spec.length; i++) {
    let component = type.component_spec[i]
    if (component.kind === Component.Kind.Value) {
      s += `let s${i}=S[${component.id}];`
    }
  }
  return s
}

let make_relation_matches_declaration = (type: Type.T) => {
  let s = `let h=0;`
  for (let i = 0; i < type.component_spec.length; i++) {
    if (Component.is_relation(type.component_spec[i])) {
      s += `h=Math.imul((h<<5)^(r${i}|0),0x9e3779b9);`
    }
  }
  s += "let M=R[h];"
  return s
}

let make_common_exps = (type: Type.T, changed: QueryChanged[]) => {
  let fetch = make_each_iterator_fetch_exp(type)
  let filter = make_each_iterator_filter_exp(changed)
  let params = make_each_iterator_params_exp(type)
  let body = make_store_declarations(type) + make_changed_declarations(changed)
  return {fetch, filter, params, body}
}

let compile_each_iterator_with_relations = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  relative_matches: Entity.T[][][],
  changed: QueryChanged[],
): Each<U> => {
  let changed_predicates = changed.map(changed => changed.predicate)
  let exps = make_common_exps(type, changed)
  let body = exps.body
  body += `return function each_iterator(${exps.params}$){`
  body += make_relation_matches_declaration(type)
  body += "if(M===undefined)return;"
  body += make_each_iterator_body(exps.fetch, exps.filter)
  body += "}"
  let closure = Function("S", "C", "R", "W", body)
  return closure(
    world.stores,
    changed_predicates,
    relative_matches,
    world.stores,
  )
}

let compile_each_iterator = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  matches: Entity.T[][],
  changed: QueryChanged[],
): Each<U> => {
  let changed_predicates = changed.map(changed => changed.predicate)
  let exps = make_common_exps(type, changed)
  let body = exps.body
  body += `return function each_iterator(${exps.params}$){`
  body += make_each_iterator_body(exps.fetch, exps.filter)
  body += "}"
  let closure = Function("S", "C", "M", body)
  return closure(world.stores, changed_predicates, matches)
}

let make_relative_keys = (query: T, node_type: Type.T) => {
  let relation_relatives: number[][] = []
  // Extract a list of the node's included relatives for each relation.
  // e.g. [[1,2,3], [5,6]]
  for (let i = 0; i < query.type.relations_spec.length; i++) {
    let relation = query.type.relations_spec[i]
    let relatives = (relation_relatives[i] ??= [])
    for (let j = 0; j < node_type.relationships.length; j++) {
      let relationship = node_type.relationships[j]
      let relation_id = Entity.parse_hi(relationship.id)
      if (relation.id === relation_id) {
        let relative = Entity.parse_lo(relationship.id)
        relatives.push(relative)
      }
    }
  }
  // Compute the cartesian product of relatives.
  // e.g. [[1,5], [1,6], [2,5], [2,6], [3,5], [3,6]]
  let relation_relatives_product = product(relation_relatives)
  // Create an integer key for each permutation for fast lookup.
  let relative_keys: number[] = []
  for (let i = 0; i < relation_relatives_product.length; i++) {
    let flat = relation_relatives_product[i].flat(1)
    relative_keys.push(Hash.words(flat))
  }
  return relative_keys
}

class QueryFilters {
  changed
  is
  not

  constructor(changed: QueryChanged[], is: Filter.T[], not: Filter.T[]) {
    this.changed = changed
    this.is = is
    this.not = not
  }
}

export class Query<U extends Component.T[] = Component.T[]> {
  #iterator: Each<U>
  filters
  matches
  monitor
  node
  relative_matches
  type

  constructor(world: World.T, type: Type.T<U>, filters: Filter.T[]) {
    let monitor = false
    for (let i = 0; i < filters.length; i++) {
      let filter = filters[i]
      if (filter.kind === Filter.Kind.In || filter.kind === Filter.Kind.Out) {
        monitor = true
        break
      }
    }
    let matches = SparseMap.make<Entity.T[]>()
    let relative_matches: Entity.T[][][] = []
    this.filters = initialize_filters(filters, world)
    this.matches = matches
    this.monitor = monitor
    this.node = Graph.resolve(world.graph, type)
    this.relative_matches = relative_matches
    this.type = type
    this.#iterator = Type.has_relations(type)
      ? compile_each_iterator_with_relations(
          world,
          type,
          relative_matches,
          this.filters.changed,
        )
      : compile_each_iterator(
          world,
          type,
          SparseMap.values(matches),
          this.filters.changed,
        )
  }

  each(
    ...params: [...relatives: Component.Relatives<U>, iteratee: EachIteratee<U>]
  ): void
  each() {
    // Execute the query's iterator function with the given parameters.
    this.#iterator.apply(null, arguments as unknown as Parameters<Each<U>>)
    // Update entity component versions for change detection.
    for (let i = 0; i < this.filters.changed.length; i++) {
      let {state} = this.filters.changed[i]
      SparseMap.each(state.stage, (key, version) => {
        state.changes[key] = version
      })
    }
    // If the query is a monitor, release the array of matched entities.
    if (this.monitor && SparseMap.size(this.matches) > 0) {
      this.relative_matches = []
      SparseMap.clear(this.matches)
    }
  }
}
export type T<U extends Component.T[] = Component.T[]> = Query<U>

let remember_node = (query: Query, node: Graph.Node, entities: Entity.T[]) => {
  for (let i = 0; i < query.filters.not.length; i++) {
    if (Type.has(node.type, query.filters.not[i].type)) {
      return false
    }
  }
  for (let i = 0; i < query.filters.is.length; i++) {
    if (!Type.has(node.type, query.filters.is[i].type)) {
      return false
    }
  }
  // If this query has relations, store the node's entities at each potential
  // permutation of its contained relatives.
  if (Type.has_relations(query.type)) {
    let relative_keys = make_relative_keys(query, node.type)
    for (let i = 0; i < relative_keys.length; i++) {
      let relative_key = relative_keys[i]
      let relative_match = (query.relative_matches[relative_key] ??= [])
      relative_match.push(entities)
    }
  }
  if (query.monitor) {
    // If the query is a monitor, copy all of the entities into a single list
    // that will be released immediately after the next iteration.
    let entity_matches = SparseMap.get(query.matches, node.type.hash)
    if (entity_matches === undefined) {
      entity_matches = []
      SparseMap.set(query.matches, node.type.hash, entity_matches)
    }
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i]
      entity_matches.push(entity)
    }
  } else {
    // If the query is not a monitor, add the live collection to the query's
    // matches. This array will not be released until the containing node is
    // destroyed.
    SparseMap.set(query.matches, node.type.hash, entities)
  }

  return true
}

let forget_node = (query: Query, node: Graph.Node) => {
  if (Type.has_relations(query.type)) {
    let relative_keys = make_relative_keys(query, node.type)
    for (let i = 0; i < relative_keys.length; i++) {
      let relative_key = relative_keys[i]
      query.relative_matches[relative_key] = undefined!
    }
  }
  SparseMap.delete(query.matches, node.type.hash)
}

let initialize_filters = (filters: Filter.T[], world: World.T) => {
  let changed: QueryChanged[] = []
  let is: Filter.T[] = []
  let not: Filter.T[] = []
  for (let i = 0; i < filters.length; i++) {
    let filter = filters[i]
    switch (filter.kind) {
      case Filter.Kind.Is:
        is.push(filter)
        break
      case Filter.Kind.Not:
        not.push(filter)
        break
      case Filter.Kind.Changed: {
        let changed_state = Changed.make_filter_state()
        let changed_predicate = Changed.compile_predicate(
          filter.type,
          world.changes,
          changed_state,
        )
        changed.push(new QueryChanged(changed_state, changed_predicate))
        break
      }
      case Filter.Kind.In:
      case Filter.Kind.Out:
        is.push(Filter.Is(filter.type))
        break
    }
  }
  return new QueryFilters(changed, is, not)
}

let init_graph_listeners_for_monitor = (query: Query, filters: Filter.T[]) => {
  for (let i = 0; i < filters.length; i++) {
    let filter = filters[i]
    switch (filter.kind) {
      case Filter.Kind.In:
      case Filter.Kind.Out: {
        let on_transition_event = (event: Transition.Event) => {
          remember_node(query, event.node, event.entities)
        }
        Signal.subscribe(
          filter.kind === Filter.Kind.In
            ? query.node.$included
            : query.node.$excluded,
          on_transition_event,
        )
        // if (filter.kind === Filter.Kind.In) {
        //   Graph.traverse(query.node, node => {
        //     remember_node(query, node, SparseSet.values(node.entities))
        //   })
        // }
        break
      }
    }
  }
}

let init_graph_listeners = (query: Query) => {
  let on_node_created = (node: Graph.Node) => {
    remember_node(query, node, SparseSet.values(node.entities))
  }
  let on_node_removed = (node: Graph.Node) => {
    forget_node(query, node)
  }
  Signal.subscribe(query.node.$created, on_node_created)
  Signal.subscribe(query.node.$removed, on_node_removed)
  Graph.traverse(query.node, on_node_created)
}

export let make = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  filters: Filter.T[],
): Query<U> => {
  let query = new Query(world, type, filters)
  if (query.monitor) {
    init_graph_listeners_for_monitor(query, filters)
  } else {
    init_graph_listeners(query)
  }
  return query
}

export let query = <U extends Component.T[]>(
  world: World.T,
  type: Type.Type<U>,
  ...filters: Filter.T[]
): Query<U> => {
  return make(world, type, filters)
}
