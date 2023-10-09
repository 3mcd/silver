import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Graph from "../world/graph"
import * as World from "../world/world"
import * as Changed from "./changed"
import * as Filter from "./filter"

type Parents<U extends Component.T[], Out extends Entity.T[] = []> = U extends [
  infer Head,
  ...infer Tail,
]
  ? Tail extends Component.T[]
    ? Parents<
        Tail,
        Head extends Component.Relation<unknown> | Component.RelationTag
          ? [...Out, Entity.T]
          : Out
      >
    : never
  : Out

type IteratorIteratee<U extends Component.T[]> = (
  entity: Entity.T,
  ...values: Component.ValuesOf<U>
) => void

type IteratorArgs<U extends Component.T[]> = [
  ...parents: Parents<U>,
  iteratee: IteratorIteratee<U>,
]
type Iterator<U extends Component.T[]> = (...args: IteratorArgs<U>) => void

class QueryRelationshipMatch {
  entities: Entity.T[][][]
  next: QueryRelationshipMatch[]

  constructor() {
    this.entities = []
    this.next = []
  }
}

class QueryChangedRecord {
  state
  predicate

  constructor(state: Changed.FilterState, predicate: Changed.Predicate) {
    this.state = state
    this.predicate = predicate
  }
}

export class Query<U extends Component.T[] = Component.T[]> {
  changed
  eachIterator
  isMonitor
  matches
  node
  not
  relationshipIndices
  relationshipMatches
  type

  constructor(world: World.T, type: Type.T<U>, filters: Filter.T[]) {
    let isMonitor = false
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]
      if (filter.kind === Filter.Kind.In || filter.kind === Filter.Kind.Out) {
        isMonitor = true
        break
      }
    }
    const matches = SparseMap.make<Entity.T[][]>()
    const {changed, not} = initializeFilters(filters, world)
    const relationshipMatches = new QueryRelationshipMatch()
    const relationshipIndices = makeRelationshipIndices(type)
    const eachIterator =
      relationshipIndices.length > 0
        ? compileEachIteratorWithRelationships(
            world,
            type,
            relationshipMatches,
            changed,
          )
        : compileEachIterator(world, type, SparseMap.values(matches), changed)
    this.changed = changed
    this.eachIterator = eachIterator
    this.isMonitor = isMonitor
    this.matches = matches
    this.node = Graph.resolve(world.graph, type)
    this.not = not
    this.relationshipIndices = relationshipIndices
    this.relationshipMatches = relationshipMatches
    this.type = type
  }

  each(...args: [...parents: Parents<U>, iteratee: IteratorIteratee<U>]): void
  each() {
    // @ts-expect-error
    this.eachIterator.apply(null, arguments)
    for (let i = 0; i < this.changed.length; i++) {
      const {state} = this.changed[i]
      SparseMap.each(state.stage, (key, version) => {
        state.changes[key] = version
      })
    }
    if (this.isMonitor) {
      forgetNode(this, this.node)
    }
  }
}
export type T<U extends Component.T[] = Component.T[]> = Query<U>

const getValueStores = (type: Type.T, world: World.T) => {
  const stores = SparseMap.make<unknown[]>()
  for (let i = 0; i < type.components.length; i++) {
    const component = type.components[i]
    if (component.kind === Component.Kind.Value) {
      SparseMap.set(stores, component.id, world.store(component.id))
    }
  }
  return stores
}

const makeIteratorFilterPredicateExpression = (changed: Query["changed"]) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `c${i}(e)===false||`
  }
  return s.slice(0, s.length - 2)
}

const makeIteratorIterateeArgsExpression = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.componentSpec.length; i++) {
    const {id, kind} = type.componentSpec[i]
    if (kind === Component.Kind.Value) {
      s += `s${id}[e],`
    } else if (kind === Component.Kind.Relation) {
      s += `W[((${id}&${Entity.HI})<<${Entity.LO_EXTENT})|p${id}][e],`
    }
  }
  return s.slice(0, s.length - 1)
}

const makeIteratorParamsExpression = (type: Type.T) => {
  let s = ""
  for (let i = 0; i < type.relations.length; i++) {
    const relation = type.relations[i]
    s += `p${relation.id},`
  }
  return s
}

const makeIteratorIterator = (fetch: string, filter: string) => {
  let s = ""
  s += "for(let i=0;i<M.length;i++){"
  s += "const m=M[i];"
  s += "for(let j=0;j<m.length;j++){"
  s += "const E=m[j];"
  s += "for(let k=0;k<E.length;k++){"
  s += "const e=E[k];"
  if (filter) {
    s += `if(${filter})continue;`
  }
  s += `$(e,${fetch})`
  s += "}}}"
  return s
}

const makeChangedDeclarations = (changed: Query["changed"]) => {
  let s = ""
  for (let i = 0; i < changed.length; i++) {
    s += `const c${i}=C[${i}];`
  }
  return s
}

const makeStoreDeclarations = (stores: SparseMap.T<unknown[]>) => {
  let s = ""
  SparseMap.each(stores, componentId => {
    s += `const s${componentId}=S[${componentId}];`
  })
  return s
}

const makeRelationMatchesDeclaration = (type: Type.T) => {
  let s = "const M=R"
  for (let i = 0; i < type.relations.length; i++) {
    const relation = type.relations[i]
    s += `?.next[p${relation.id}]`
  }
  return s + "?.entities;"
}

const makeCommonExpressions = (
  type: Type.T,
  changed: Query["changed"],
  stores: SparseMap.SparseMap<unknown[]>,
) => {
  const filter = makeIteratorFilterPredicateExpression(changed)
  const fetch = makeIteratorIterateeArgsExpression(type)
  const args = makeIteratorParamsExpression(type)
  const body = makeStoreDeclarations(stores) + makeChangedDeclarations(changed)
  return {filter, fetch, args, body}
}

const compileEachIteratorWithRelationships = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  relationshipMatches: QueryRelationshipMatch,
  changed: Query["changed"],
): Iterator<U> => {
  const changedPredicates = changed.map(changed => changed.predicate)
  const stores = getValueStores(type, world)
  const storesSparse = SparseMap.toSparseArray(stores)
  const exps = makeCommonExpressions(type, changed, stores)
  let body = exps.body
  body += `return function eachIterator(${exps.args}$){`
  body += makeRelationMatchesDeclaration(type)
  body += "if(M===undefined)return;"
  body += makeIteratorIterator(exps.fetch, exps.filter)
  body += "}"
  const closure = Function("S", "C", "R", "W", body)
  return closure(
    storesSparse,
    changedPredicates,
    relationshipMatches,
    world.stores,
  )
}

const compileEachIterator = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  matches: ReadonlyArray<readonly Entity.T[][]>,
  changed: Query["changed"],
): Iterator<U> => {
  const changedPredicates = changed.map(changed => changed.predicate)
  const stores = getValueStores(type, world)
  const storesSparse = SparseMap.toSparseArray(stores)
  const exps = makeCommonExpressions(type, changed, stores)
  let body = exps.body
  body += `return function eachIterator(${exps.args}$){`
  body += makeIteratorIterator(exps.fetch, exps.filter)
  body += "}"
  const closure = Function("S", "C", "M", body)
  return closure(storesSparse, changedPredicates, matches)
}

const makeRelationshipPath = (type: Type.T, relationshipIndices: number[]) => {
  const relationshipPath: number[] = []
  for (let i = 0; i < type.relationships.length; i++) {
    const relationship = type.relationships[i]
    const relationshipComponentId = Entity.parseHi(relationship.id)
    const relationshipIndex = relationshipIndices[relationshipComponentId]
    if (relationshipIndex === undefined) continue
    relationshipPath[relationshipIndex] = Entity.parseEntityId(relationship.id)
  }
  return relationshipPath
}

const watchNode = (
  query: Query,
  node: Graph.Node,
  entities = SparseSet.values(node.entities),
) => {
  for (let i = 0; i < query.not.length; i++) {
    if (Type.has(node.type, query.not[i].type)) return false
  }
  const relationshipPath = makeRelationshipPath(
    node.type,
    query.relationshipIndices,
  )
  if (relationshipPath.length > 0) {
    let i = 0
    let relationshipMatches = query.relationshipMatches
    while (i < relationshipPath.length) {
      relationshipMatches = relationshipMatches.next[relationshipPath[i++]] ??=
        {entities: [], next: []}
    }
    relationshipMatches.entities.push([entities])
  }
  let matches = SparseMap.get(query.matches, node.type.componentsHash)
  if (matches === undefined) {
    matches = []
    SparseMap.set(query.matches, node.type.componentsHash, matches)
  }
  matches.push(entities)
  return true
}

const forgetNode = (query: Query, node: Graph.Node) => {
  const relationshipPath = makeRelationshipPath(
    node.type,
    query.relationshipIndices,
  )
  if (relationshipPath.length > 0) {
    let i = 0
    let relationshipMatch = query.relationshipMatches
    while (i < relationshipPath.length - 1) {
      relationshipMatch = relationshipMatch.next[relationshipPath[i++]]
    }
    relationshipMatch.next[relationshipPath[i]] = undefined!
  }
  SparseMap.delete(query.matches, node.type.componentsHash)
}

const initializeFilters = (filters: Filter.T[], world: World.T) => {
  const changed: QueryChangedRecord[] = []
  const not: Filter.T[] = []
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i]
    switch (filter.kind) {
      case Filter.Kind.Not:
        not.push(filter)
        break
      case Filter.Kind.Changed: {
        const changedState = Changed.makeFilterState()
        const changedPredicate = Changed.compilePredicate(
          filter.type,
          world.changes,
          changedState,
        )
        changed.push(new QueryChangedRecord(changedState, changedPredicate))
        break
      }
    }
  }
  return {changed, not}
}

const makeRelationshipIndices = (type: Type.T) => {
  const relationshipIndices = [] as number[]
  let j = 0
  for (let i = 0; i < type.componentSpec.length; i++) {
    const component = type.componentSpec[i]
    if (Component.isRelation(component)) {
      relationshipIndices[component.id] = j++
    }
  }
  return relationshipIndices
}

const initMonitorGraphListeners = (query: Query, filters: Filter.T[]) => {
  const onMonitorEntities = (
    type: Type.T,
    entities: Entity.T[],
    node: Graph.Node,
  ) => {
    if (Type.isSuperset(node.type, type)) {
      watchNode(query, query.node, entities)
    }
  }
  for (let i = 0; i < filters.length; i++) {
    const {kind, type} = filters[i]
    switch (kind) {
      case Filter.Kind.In:
      case Filter.Kind.Out:
        Signal.subscribe(
          kind === Filter.Kind.In ? query.node.$included : query.node.$excluded,
          function watchIncludedEntities(event) {
            onMonitorEntities(type, event.entities, event.node)
          },
        )
        break
    }
  }
}

const initQueryGraphListeners = (query: Query, filters: Filter.T[]) => {
  const onNodeCreated = (node: Graph.Node) => {
    watchNode(query, node)
  }
  const onNodeRemoved = (node: Graph.Node) => {
    forgetNode(query, node)
  }
  Signal.subscribe(query.node.$created, onNodeCreated)
  Signal.subscribe(query.node.$removed, onNodeRemoved)
  Graph.traverse(query.node, onNodeCreated)
}

export const make = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  filters: Filter.T[],
): Query<U> => {
  const query = new Query(world, type, filters)
  if (query.isMonitor) {
    initMonitorGraphListeners(query, filters)
  } else {
    initQueryGraphListeners(query, filters)
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
