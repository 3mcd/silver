import {product} from "../array"
import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Changes from "../entity/entity_versions"
import * as Hash from "../hash"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Graph from "../world/graph"
import * as Node from "../world/node"
import * as Transition from "../world/transaction"
import * as World from "../world/world"
import * as Changed from "./changed"
import * as Filter from "./filter"

type EachIteratee<U extends Component.T[]> = (
  entity: Entity.T,
  ...values: Component.ValuesOf<U>
) => void

export type EachArgs<U extends Component.T[]> = [
  ...relatives: Component.Relatives<U>,
  iteratee: EachIteratee<U>,
]
type Each<U extends Component.T[]> = (...params: EachArgs<U>) => void

class Query<U extends Component.T[]> {
  readonly type
  readonly filters
  constructor(type: Type.T<U>, filters: Filter.T[]) {
    this.type = type
    this.filters = filters
  }
}
export type T<U extends Component.T[] = Component.T[]> = Query<U>

export class CompiledQuery<U extends Component.T[] = Component.T[]>
  implements Node.Listener
{
  #iterator
  filters
  filters_raw
  matches
  is_monitor
  relative_matches
  type
  world

  constructor(world: World.T, type: Type.T<U>, filters: Filter.T[]) {
    let is_monitor = false
    for (let i = 0; i < filters.length; i++) {
      let filter = filters[i]
      if (filter.kind === Filter.Kind.In || filter.kind === Filter.Kind.Out) {
        is_monitor = true
        break
      }
    }
    let matches = SparseMap.make<Entity.T[]>()
    let node = Graph.resolve_node_by_type(world.graph, type)
    Node.add_listener(node, this, !is_monitor)

    this.filters_raw = filters
    this.filters = initialize_filters(filters, world)
    this.matches = matches
    this.is_monitor = is_monitor
    this.relative_matches = [] as Entity.T[][][]
    this.type = type
    this.world = world
    for (let i = 0; i < type.vec.length; i++) {
      let component = type.vec[i]
      if (Component.is_ref(component)) {
        world.store(component.id)
      }
    }
    Assert.ok(type.pair_state !== Type.PairState.Paired)
    this.#iterator =
      type.pair_state === Type.PairState.Unpaired
        ? compile_each_iterator_with_relations(this)
        : compile_each_iterator(this)
  }

  for_each(...args: EachArgs<U>): void
  for_each() {
    // Execute the query's iterator function with the given parameters.
    this.#iterator.apply(null, arguments as unknown as Parameters<Each<U>>)
    // Update entity component versions for change detection.
    for (let i = 0; i < this.filters.changed.length; i++) {
      let {a, stage} = this.filters.changed[i]
      SparseMap.each(stage, (key, version) => {
        Changes.set_at_key(a, key, version)
      })
      SparseMap.clear(stage)
    }
    // If the query is a monitor, release the array of matched entities.
    if (this.is_monitor && SparseMap.size(this.matches) > 0) {
      // TODO: This is very slow.
      this.relative_matches.length = 0
      SparseMap.clear(this.matches)
    }
  }

  on_entities_in(batch: Transition.Batch): void {
    if (!this.is_monitor) {
      return
    }

    for (let i = 0; i < this.filters_raw.length; i++) {
      const filter = this.filters_raw[i]
      if (filter.kind === Filter.Kind.In) {
        batch.next_node
      }
    }

    //   filter.kind === Filter.Kind.In
    //   ? query.node.$included
    //   : query.node.$excluded,
    // filter.kind === Filter.Kind.In
    //   ? query.on_batch_in
    //   : query.on_batch_out,
  }

  on_entities_out(batch: Transition.Batch): void {
    if (!this.is_monitor) {
      return
    }
  }

  // on_node_entities_changed?(): void
  on_node_created(node: Node.T) {
    if (this.is_monitor) {
      return
    }
    remember_node(this, node)
  }

  on_node_disposed?(node: Node.T) {
    if (this.is_monitor) {
      return
    }
    forget_node(this, node)
  }
  // on_entities_in?(batch: Transaction.Batch): void
  // on_entities_out?(batch: Transaction.Batch): void

  on_batch_in = (batch: Transition.Batch): void => {
    remember_node(
      this,
      Assert.exists(batch.next_node),
      SparseSet.values(batch.entities),
    )
  }

  on_batch_out = (batch: Transition.Batch): void => {
    remember_node(
      this,
      Assert.exists(batch.prev_node),
      SparseSet.values(batch.entities),
    )
  }
}

// P = predicates, p = predicate
// S = value stores, s = value store
// R = relation matches, r = relative
// M = entity matches
// e = entity
// c = callback
// T = temp value stores, t = temp value store
// h = hash (used to look up matches for provided relatives)

let make_each_iterator_filter_expression = (filters: QueryFilters) => {
  let s = ""
  for (let i = 0; i < filters.changed.length; i++) {
    s += `p${i}(e)===false||`
  }
  return s.slice(0, s.length - 2)
}

let make_each_iterator_fetch_expression = (type: Type.T, out: Type.T) => {
  let s = ""
  for (let i = 0; i < type.def.length; i++) {
    let component = type.def[i]
    if (component.kind === Component.Kind.Ref) {
      s +=
        out.def.length === 0
          ? `s${i}[e],`
          : Type.has_component(out, component)
          ? `t${i}.dense[t${i}.sparse[e]],`
          : `s${i}[e]??t${i}.dense[t${i}.sparse[e]],`
    } else if (component.kind === Component.Kind.RefRelation) {
      let pair = `${(component.id & Entity.HI) << Entity.LO_EXTENT}|r${i}`
      s +=
        out.def.length === 0
          ? `S[${pair}][e],`
          : Type.has_component(out, component)
          ? // TODO: This is broken.
            `T[${pair}][e],`
          : `S[${pair}][e]??T[${pair}][e],`
    }
  }
  return s.slice(0, s.length - 1)
}

let make_each_iterator_params_expression = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.def.length; i++) {
    if (Component.is_relation(type.def[i])) {
      s += `r${i},`
    }
  }
  return s
}

let make_each_iterator_body = (fetch: string, filter: string) => {
  let s = ""
  s += "for(let i=0;i<M.length;i++){"
  s += "let m=M[i];"
  s += "for(let j=0;j<m.length;j++){"
  s += "let e=m[j];"
  if (filter) {
    s += `if(${filter})continue;`
  }
  s += `c(e,${fetch})`
  s += "}}"
  return s
}

let make_predicate_declarations = (filters: QueryFilters) => {
  let s = ""
  for (let i = 0; i < filters.changed.length; i++) {
    s += `let p${i}=P[${i}];`
  }
  return s
}

let make_store_declarations = (type: Type.T, out: Type.T) => {
  let s = ""
  for (let i = 0; i < type.def.length; i++) {
    let component = type.def[i]
    if (component.kind === Component.Kind.Ref) {
      s += `let s${i}=S[${component.id}];`
      if (out.def.length > 0) {
        s += `let t${i}=T.dense[T.sparse[${component.id}]];`
      }
    }
  }
  return s
}

let make_relation_matches_declarations = (type: Type.T) => {
  let s = `let h=${Hash.HASH_BASE};`
  for (let i = 0; i < type.def.length; i++) {
    if (Component.is_relation(type.def[i])) {
      s += `h=Math.imul(h^r${i},${Hash.HASH_ENTROPY});`
    }
  }
  s += "let M=R[h>>>0];"
  return s
}

let make_common_expressions = (type: Type.T, filters: QueryFilters) => {
  let fetch = make_each_iterator_fetch_expression(type, filters.out)
  let filter = make_each_iterator_filter_expression(filters)
  let params = make_each_iterator_params_expression(type)
  let body =
    make_store_declarations(type, filters.out) +
    make_predicate_declarations(filters)
  return {fetch, filter, params, body}
}

let compile_each_iterator_with_relations = <U extends Component.T[]>(
  query: CompiledQuery<U>,
): Each<U> => {
  let exps = make_common_expressions(query.type, query.filters)
  let body = exps.body
  body += `return(${exps.params}c)=>{`
  body += make_relation_matches_declarations(query.type)
  body += "if(M===void 0)return;"
  body += make_each_iterator_body(exps.fetch, exps.filter)
  body += "}"
  return Function(
    "S",
    "T",
    "P",
    "R",
    body,
  )(
    query.world.entity_data,
    query.world.temp_data,
    query.filters.changed.map(changed => changed.predicate),
    query.relative_matches,
  )
}

let compile_each_iterator = <U extends Component.T[]>(
  query: CompiledQuery<U>,
): Each<U> => {
  let exps = make_common_expressions(query.type, query.filters)
  let body = exps.body
  body += `return(${exps.params}c)=>{`
  body += make_each_iterator_body(exps.fetch, exps.filter)
  body += "}"
  return Function(
    "S",
    "T",
    "P",
    "M",
    body,
  )(
    query.world.entity_data,
    query.world.temp_data,
    query.filters.changed.map(changed => changed.predicate),
    SparseMap.values(query.matches),
  )
}

let make_relative_keys = (query: CompiledQuery, nodeType: Type.T) => {
  let relatives: number[][] = []
  // Extract a list of the node's included relatives for each relation.
  // e.g. [[1,2,3], [5,6]]
  for (let i = 0; i < query.type.rels.length; i++) {
    let relation = query.type.rels[i]
    let relation_relatives = (relatives[i] ??= [])
    for (let j = 0; j < nodeType.pairs.length; j++) {
      let pair = nodeType.pairs[j]
      let relation_id = Entity.parse_hi(pair.id)
      if (relation.id === relation_id) {
        let relative = Entity.parse_lo(pair.id)
        relation_relatives.push(relative)
      }
    }
  }
  // Compute the cartesian product of relatives.
  // e.g. [[1,5], [1,6], [2,5], [2,6], [3,5], [3,6]]
  let relativesProduct = product(relatives)
  // Create an integer key for each permutation for fast lookup.
  let relativesKeys: number[] = []
  for (let i = 0; i < relativesProduct.length; i++) {
    let flat = relativesProduct[i].flat(1)
    relativesKeys.push(Hash.as_uint(Hash.hash_words(flat)))
  }
  return relativesKeys
}

class QueryFilters {
  changed
  is
  not
  out

  constructor(
    changed: Changed.T[],
    is: Filter.T[],
    not: Filter.T[],
    out: Filter.T[],
  ) {
    this.changed = changed
    this.is = is
    this.not = not
    this.out = Type.from(out.map(filter => filter.type))
  }
}

let remember_node = (
  query: CompiledQuery,
  node: Node.T,
  entities = SparseSet.values(node.entities),
) => {
  for (let i = 0; i < query.filters.not.length; i++) {
    if (Type.has(node.type, query.filters.not[i].type)) {
      return
    }
  }
  for (let i = 0; i < query.filters.is.length; i++) {
    if (!Type.has(node.type, query.filters.is[i].type)) {
      return
    }
  }
  // If this query has relations, store the node's entities at each potential
  // permutation of its contained relatives.
  if (query.type.pair_state === Type.PairState.Unpaired) {
    let relative_keys = make_relative_keys(query, node.type)
    for (let i = 0; i < relative_keys.length; i++) {
      let relative_key = relative_keys[i]
      let relative_match = (query.relative_matches[relative_key] ??= [])
      relative_match.push(entities)
    }
  }
  if (query.is_monitor) {
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
}

let forget_node = (query: CompiledQuery, node: Node.T) => {
  if (query.type.pair_state === Type.PairState.Unpaired) {
    let relative_keys = make_relative_keys(query, node.type)
    for (let i = 0; i < relative_keys.length; i++) {
      let relative_key = relative_keys[i]
      query.relative_matches[relative_key] = undefined!
    }
  }
  SparseMap.delete(query.matches, node.type.hash)
}

let initialize_filters = (filters: Filter.T[], world: World.T) => {
  let changed: Changed.T[] = []
  let is: Filter.T[] = []
  let not: Filter.T[] = []
  let out: Filter.T[] = []
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
        changed.push(Changed.make(filter.type, world.entity_versions))
        break
      }
      case Filter.Kind.In:
      case Filter.Kind.Out:
        is.push(Filter.Is(filter.type))
        if (filter.kind === Filter.Kind.Out) {
          out.push(filter)
        }
        break
    }
  }
  return new QueryFilters(changed, is, not, out)
}

let init_node_listeners_monitor = (
  query: CompiledQuery,
  filters: Filter.T[],
) => {
  for (let i = 0; i < filters.length; i++) {
    let filter = filters[i]
    switch (filter.kind) {
      case Filter.Kind.In:
      case Filter.Kind.Out: {
        Signal.subscribe(
          filter.kind === Filter.Kind.In
            ? query.node.$included
            : query.node.$excluded,
          filter.kind === Filter.Kind.In
            ? query.on_batch_in
            : query.on_batch_out,
        )
        if (filter.kind === Filter.Kind.In) {
          Node.traverse_right(query.node, node => {
            remember_node(query, node, SparseSet.values(node.entities))
          })
        }
        break
      }
    }
  }
}

let init_node_listeners = (query: CompiledQuery) => {
  let on_node_created = (node: Node.T) => {
    remember_node(query, node)
  }
  let on_node_removed = (node: Node.T) => {
    forget_node(query, node)
  }
  Signal.subscribe(query.node.$created, on_node_created)
  Signal.subscribe(query.node.$disposed, on_node_removed)
  Node.traverse_right(query.node, on_node_created)
}

export let compile = <U extends Component.T[]>(
  world: World.T,
  query: Query<U>,
): CompiledQuery<U> => {
  return new CompiledQuery(world, query.type, query.filters)
}

type ExcludeFilters<T extends unknown[]> = T extends []
  ? []
  : T extends [infer H, ...infer R]
  ? H extends Filter.T
    ? ExcludeFilters<R>
    : [H, ...ExcludeFilters<R>]
  : never

export function query<const U extends (Type.T | Component.T | Filter.T)[]>(
  ...terms: U
): Query<Type.Normalized<ExcludeFilters<U>>> {
  const types = terms.filter(Type.is_type)
  const type = Type.from(types)
  const filters = terms.filter(
    term => term instanceof Filter.Filter,
  ) as Filter.T[]
  return new Query(type, filters)
}
