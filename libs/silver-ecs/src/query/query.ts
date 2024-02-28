import {product} from "../array"
import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Hash from "../hash"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Changes from "../entity/entity_versions"
import * as Graph from "../world/graph"
import * as Transition from "../world/transaction"
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

// P = predicates, p = predicate
// S = value stores, s = value store
// R = relation matches, r = relative
// M = entity matches
// e = entity
// c = callback
// T = temp value stores, t = temp value store
// h = hash (used to look up matches for provided relatives)

let makeEachIteratorFilterExp = (filters: QueryFilters) => {
  let s = ""
  for (let i = 0; i < filters.changed.length; i++) {
    s += `p${i}(e)===false||`
  }
  return s.slice(0, s.length - 2)
}

let makeEachIteratorFetchExp = (type: Type.T, out: Type.T) => {
  let s = ""
  for (let i = 0; i < type.components.length; i++) {
    let component = type.components[i]
    if (component.kind === Component.Kind.Ref) {
      s +=
        out.components.length === 0
          ? `s${i}[e],`
          : Type.has_component(out, component)
          ? `t${i}.dense[t${i}.sparse[e]],`
          : `s${i}[e]??t${i}.dense[t${i}.sparse[e]],`
    } else if (component.kind === Component.Kind.RefRelation) {
      let pair = `${(component.id & Entity.HI) << Entity.LO_EXTENT}|r${i}`
      s +=
        out.components.length === 0
          ? `S[${pair}][e],`
          : Type.has_component(out, component)
          ? // TODO: This is broken.
            `T[${pair}][e],`
          : `S[${pair}][e]??T[${pair}][e],`
    }
  }
  return s.slice(0, s.length - 1)
}

let makeEachIteratorParamsExp = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.components.length; i++) {
    if (Component.isRelation(type.components[i])) {
      s += `r${i},`
    }
  }
  return s
}

let makeEachIteratorBody = (fetch: string, filter: string) => {
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

let makePredicateDeclarations = (filters: QueryFilters) => {
  let s = ""
  for (let i = 0; i < filters.changed.length; i++) {
    s += `let p${i}=P[${i}];`
  }
  return s
}

let makeStoreDeclarations = (type: Type.T, out: Type.T) => {
  let s = ""
  for (let i = 0; i < type.components.length; i++) {
    let component = type.components[i]
    if (component.kind === Component.Kind.Ref) {
      s += `let s${i}=S[${component.id}];`
      if (out.components.length > 0) {
        s += `let t${i}=T.dense[T.sparse[${component.id}]];`
      }
    }
  }
  return s
}

let makeRelationMatchesDeclarations = (type: Type.T) => {
  let s = `let h=${Hash.HASH_BASE};`
  for (let i = 0; i < type.components.length; i++) {
    if (Component.isRelation(type.components[i])) {
      s += `h=Math.imul(h^r${i},${Hash.HASH_ENTROPY});`
    }
  }
  s += "let M=R[h>>>0];"
  return s
}

let makeCommonExps = (type: Type.T, filters: QueryFilters) => {
  let fetch = makeEachIteratorFetchExp(type, filters.out)
  let filter = makeEachIteratorFilterExp(filters)
  let params = makeEachIteratorParamsExp(type)
  let body =
    makeStoreDeclarations(type, filters.out) +
    makePredicateDeclarations(filters)
  return {fetch, filter, params, body}
}

let compileEachIteratorWithRelations = <U extends Component.T[]>(
  query: Query<U>,
): Each<U> => {
  let exps = makeCommonExps(query.type, query.filters)
  let body = exps.body
  body += `return(${exps.params}c)=>{`
  body += makeRelationMatchesDeclarations(query.type)
  body += "if(M===void 0)return;"
  body += makeEachIteratorBody(exps.fetch, exps.filter)
  body += "}"
  return Function(
    "S",
    "T",
    "P",
    "R",
    body,
  )(
    query.world.stores,
    query.world.temp,
    query.filters.changed.map(changed => changed.predicate),
    query.relativeMatches,
  )
}

let compileEachIterator = <U extends Component.T[]>(
  query: Query<U>,
): Each<U> => {
  let exps = makeCommonExps(query.type, query.filters)
  let body = exps.body
  body += `return(${exps.params}c)=>{`
  body += makeEachIteratorBody(exps.fetch, exps.filter)
  body += "}"
  return Function(
    "S",
    "T",
    "P",
    "M",
    body,
  )(
    query.world.stores,
    query.world.temp,
    query.filters.changed.map(changed => changed.predicate),
    SparseMap.values(query.matches),
  )
}

let makeRelativesKeys = (query: T, nodeType: Type.T) => {
  let relatives: number[][] = []
  // Extract a list of the node's included relatives for each relation.
  // e.g. [[1,2,3], [5,6]]
  for (let i = 0; i < query.type.relations.length; i++) {
    let relation = query.type.relations[i]
    let relationRelatives = (relatives[i] ??= [])
    for (let j = 0; j < nodeType.pairs.length; j++) {
      let pair = nodeType.pairs[j]
      let relationId = Entity.parseHi(pair.id)
      if (relation.id === relationId) {
        let relative = Entity.parseLo(pair.id)
        relationRelatives.push(relative)
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

export class Query<U extends Component.T[] = Component.T[]> {
  #iterator: Each<U>
  filters
  matches
  isMonitor
  node
  relativeMatches
  type
  world

  constructor(world: World.T, type: Type.T<U>, filters: Filter.T[]) {
    let isMonitor = false
    for (let i = 0; i < filters.length; i++) {
      let filter = filters[i]
      if (filter.kind === Filter.Kind.In || filter.kind === Filter.Kind.Out) {
        isMonitor = true
        break
      }
    }
    let matches = SparseMap.make<Entity.T[]>()
    let relativeMatches: Entity.T[][][] = []
    this.filters = initializeFilters(filters, world)
    this.matches = matches
    this.isMonitor = isMonitor
    this.node = Graph.resolve_node_by_type(world.graph, type)
    this.relativeMatches = relativeMatches
    this.type = type
    this.world = world
    for (let i = 0; i < type.ordered.length; i++) {
      let component = type.ordered[i]
      if (Component.isValue(component)) {
        world.store(component.id)
      }
    }
    Assert.ok(type.kind !== Type.Kind.Paired)
    this.#iterator =
      type.kind === Type.Kind.Unpaired
        ? compileEachIteratorWithRelations(this)
        : compileEachIterator(this)
  }

  each(
    ...params: [...relatives: Component.Relatives<U>, iteratee: EachIteratee<U>]
  ): void
  each() {
    // Execute the query's iterator function with the given parameters.
    this.#iterator.apply(null, arguments as unknown as Parameters<Each<U>>)
    // Update entity component versions for change detection.
    for (let i = 0; i < this.filters.changed.length; i++) {
      let {a, stage} = this.filters.changed[i]
      SparseMap.each(stage, (key, version) => {
        Changes.setAtKey(a, key, version)
      })
      SparseMap.clear(stage)
    }
    // If the query is a monitor, release the array of matched entities.
    if (this.isMonitor && SparseMap.size(this.matches) > 0) {
      // TODO: This is very slow.
      this.relativeMatches.length = 0
      SparseMap.clear(this.matches)
    }
  }
}
export type T<U extends Component.T[] = Component.T[]> = Query<U>

let rememberNode = (query: Query, node: Graph.Node, entities: Entity.T[]) => {
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
  if (query.type.kind === Type.Kind.Unpaired) {
    let relativeKeys = makeRelativesKeys(query, node.type)
    for (let i = 0; i < relativeKeys.length; i++) {
      let relativeKey = relativeKeys[i]
      let relativeMatch = (query.relativeMatches[relativeKey] ??= [])
      relativeMatch.push(entities)
    }
  }
  if (query.isMonitor) {
    // If the query is a monitor, copy all of the entities into a single list
    // that will be released immediately after the next iteration.
    let entityMatches = SparseMap.get(query.matches, node.type.hash)
    if (entityMatches === undefined) {
      entityMatches = []
      SparseMap.set(query.matches, node.type.hash, entityMatches)
    }
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i]
      entityMatches.push(entity)
    }
  } else {
    // If the query is not a monitor, add the live collection to the query's
    // matches. This array will not be released until the containing node is
    // destroyed.
    SparseMap.set(query.matches, node.type.hash, entities)
  }
}

let forgetNode = (query: Query, node: Graph.Node) => {
  if (query.type.kind === Type.Kind.Unpaired) {
    let relativeKeys = makeRelativesKeys(query, node.type)
    for (let i = 0; i < relativeKeys.length; i++) {
      let relativeKey = relativeKeys[i]
      query.relativeMatches[relativeKey] = undefined!
    }
  }
  SparseMap.delete(query.matches, node.type.hash)
}

let initializeFilters = (filters: Filter.T[], world: World.T) => {
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

let initGraphListenersForMonitor = (query: Query, filters: Filter.T[]) => {
  for (let i = 0; i < filters.length; i++) {
    let filter = filters[i]
    switch (filter.kind) {
      case Filter.Kind.In:
      case Filter.Kind.Out: {
        let onBatch = (batch: Transition.Batch) => {
          rememberNode(
            query,
            Assert.exists(
              filter.kind === Filter.Kind.In
                ? batch.next_node
                : batch.prev_node,
            ),
            SparseSet.values(batch.entities),
          )
        }
        Signal.subscribe(
          filter.kind === Filter.Kind.In
            ? query.node.$included
            : query.node.$excluded,
          onBatch,
        )
        if (filter.kind === Filter.Kind.In) {
          Graph.traverse_right(query.node, node => {
            rememberNode(query, node, SparseSet.values(node.entities))
          })
        }
        break
      }
    }
  }
}

let initGraphListeners = (query: Query) => {
  let onNodeCreated = (node: Graph.Node) => {
    rememberNode(query, node, SparseSet.values(node.entities))
  }
  let onNodeRemoved = (node: Graph.Node) => {
    forgetNode(query, node)
  }
  Signal.subscribe(query.node.$created, onNodeCreated)
  Signal.subscribe(query.node.$disposed, onNodeRemoved)
  Graph.traverse_right(query.node, onNodeCreated)
}

export let make = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  filters: Filter.T[],
): Query<U> => {
  let query = new Query(world, type, filters)
  if (query.isMonitor) {
    initGraphListenersForMonitor(query, filters)
  } else {
    initGraphListeners(query)
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
