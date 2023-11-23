export {run} from "./app/system"
export {Topology, relation, tag, value, valueRelation} from "./data/component"
export type {
  ValueRelation as Relation,
  Tag,
  TagRelation,
  Value,
  T as Component,
} from "./data/component"
export {
  isRelation,
  isRelationship,
  isTag,
  isTagRelationship,
  storesValue,
  getRelation,
} from "./data/component"
export * from "./data/schema"
export {make as type, componentAt, has as hasComponent} from "./data/type"
export type {Type} from "./data/type"
export type {Entity} from "./entity/entity"
export {Changed, In, Is, Not, Out} from "./query/filter"
export type {Filter} from "./query/filter"
export {query} from "./query/query"
export type {Query} from "./query/query"
export * as Signal from "./signal"
export * as SparseMap from "./sparse/sparse_map"
export * as SparseSet from "./sparse/sparse_set"
export {traverse} from "./world/graph"
export {makeWorld as make} from "./world/world"
export type {World} from "./world/world"
import type {Type} from "./data/type"
import type {Init} from "./world/commands"
import type {World} from "./world/world"
export type Data<T extends Type> = T extends Type<infer U> ? Init<U> : never
export type System = (world: World) => () => void
export * as Graph from "./world/graph"
export * as Hash from "./hash"
export {parseLo, parseHi} from "./entity/entity"
export * as Schema from "./data/schema"

type InitType<U extends Type> = U extends Type<infer T> ? Init<T> : never
export type {InitType as Init}
