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
import * as Assert from "../assert"

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

let makeEachIteratorFilterExp = (changed: QueryChanged[]) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `c${i}(e)===false||`
  }
  return s.slice(0, s.length - 2)
}

let makeEachIteratorFetchExp = (type: Type.T, out: Type.T) => {
  let s = ""
  for (let i = 0; i < type.components.length; i++) {
    let component = type.components[i]
    if (component.kind === Component.Kind.Value) {
      s +=
        out.components.length === 0
          ? `s0${i}[e],`
          : Type.hasComponent(out, component)
          ? `s1${i}.dense[s1${i}.sparse[e]],`
          : `s0${i}[e]??s1${i}.dense[s1${i}.sparse[e]],`
    } else if (component.kind === Component.Kind.ValueRelation) {
      let pair = `${(component.id & Entity.HI) << Entity.LO_EXTENT}|r${i}`
      s +=
        out.components.length === 0
          ? `S0[${pair}][e],`
          : Type.hasComponent(out, component)
          ? `S1[${pair}][e],`
          : `S0[${pair}][e]??S1[${pair}][e],`
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

let makeEachIteratorBody = (fetchExp: string, filter: string) => {
  let s = ""
  s += "for(let i=0;i<M.length;i++){"
  s += "let m=M[i];"
  s += "for(let j=0;j<m.length;j++){"
  s += "let e=m[j];"
  if (filter) {
    s += `if(${filter})continue;`
  }
  s += `$(e,${fetchExp})`
  s += "}}"
  return s
}

let makeChangedDeclarations = (changed: QueryChanged[]) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `let c${i}=C[${i}];`
  }
  return s
}

let makeStoreDeclarations = (type: Type.T, out: Type.T) => {
  let s = ""
  for (let i = 0; i < type.components.length; i++) {
    let component = type.components[i]
    if (component.kind === Component.Kind.Value) {
      s += `let s0${i}=S0[${component.id}];`
      if (out.components.length > 0) {
        s += `let s1${i}=S1.dense[S1.sparse[${component.id}]];`
      }
    }
  }
  return s
}

let makeRelationMatchesDeclarations = (type: Type.T) => {
  let s = `let h=0x811c9dc5|0;`
  for (let i = 0; i < type.components.length; i++) {
    if (Component.isRelation(type.components[i])) {
      s += `h=Math.imul(h^r${i},0x01000193|0);`
    }
  }
  s += "let M=R[h];"
  return s
}

let makeCommonExps = (type: Type.T, filters: QueryFilters) => {
  let fetch = makeEachIteratorFetchExp(type, filters.out)
  let filter = makeEachIteratorFilterExp(filters.changed)
  let params = makeEachIteratorParamsExp(type)
  let body =
    makeStoreDeclarations(type, filters.out) +
    makeChangedDeclarations(filters.changed)
  return {fetch, filter, params, body}
}

let compileEachIteratorWithRelations = <U extends Component.T[]>(
  query: Query<U>,
): Each<U> => {
  let {world, type, relativeMatches: matches, filters} = query
  let exps = makeCommonExps(type, filters)
  let body = exps.body
  body += `return function eachIterator(${exps.params}$){`
  body += makeRelationMatchesDeclarations(type)
  body += "if(M===undefined)return;"
  body += makeEachIteratorBody(exps.fetch, exps.filter)
  body += "}"
  let closure = Function("S0", "S1", "C", "R", body)
  return closure(
    world.stores,
    world.storesOut,
    filters.changed.map(changed => changed.predicate),
    matches, // R->M based on relatives passed to iterator
  )
}

let compileEachIterator = <U extends Component.T[]>(
  query: Query<U>,
): Each<U> => {
  let {world, type, matches, filters} = query
  let exps = makeCommonExps(type, filters)
  let body = exps.body
  body += `return function eachIterator(${exps.params}$){`
  body += makeEachIteratorBody(exps.fetch, exps.filter)
  body += "}"
  let closure = Function("S0", "S1", "C", "M", body)
  return closure(
    world.stores,
    world.storesOut,
    filters.changed.map(changed => changed.predicate),
    SparseMap.values(matches),
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
    relativesKeys.push(Hash.words(flat))
  }
  return relativesKeys
}

class QueryFilters {
  changed
  is
  not
  out

  constructor(
    changed: QueryChanged[],
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
    this.node = Graph.resolve(world.graph, type)
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
      let {state} = this.filters.changed[i]
      SparseMap.each(state.stage, (key, version) => {
        state.changes[key] = version
      })
    }
    // If the query is a monitor, release the array of matched entities.
    if (this.isMonitor && SparseMap.size(this.matches) > 0) {
      this.relativeMatches = []
      SparseMap.clear(this.matches)
    }
  }
}
export type T<U extends Component.T[] = Component.T[]> = Query<U>

let rememberNode = (query: Query, node: Graph.Node, entities: Entity.T[]) => {
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

  return true
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
  let changed: QueryChanged[] = []
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
        let changedState = Changed.makeFilterState()
        let changedPredicate = Changed.compilePredicate(
          filter.type,
          world.changes,
          changedState,
        )
        changed.push(new QueryChanged(changedState, changedPredicate))
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
              filter.kind === Filter.Kind.In ? batch.nextNode : batch.prevNode,
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
          Graph.traverse(query.node, node => {
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
  Signal.subscribe(query.node.$removed, onNodeRemoved)
  Graph.traverse(query.node, onNodeCreated)
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
