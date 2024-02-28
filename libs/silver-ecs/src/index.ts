export {run} from "./app/system"
export {
  Topology,
  findById as findComponentById,
  findById as getRelation,
  isRelation,
  isPair as isRelationship,
  isTag,
  isTagRelationship,
  isValue,
  isRefRelation as isValueRelation,
  isValueRelationship,
  relation,
  storesValue,
  tag,
  ref,
  refRelation as valueRelation,
} from "./data/component"
export type {
  T as Component,
  RefPair as Relation,
  Tag,
  TagRelation,
  Ref as Value,
} from "./data/component"
export * from "./data/schema"
export * as Schema from "./data/schema"
export {
  component_at as componentAt,
  has as hasComponent,
  make as type,
  from as type_from_components,
} from "./data/type"
export type {Type, Unitary} from "./data/type"
export {parseHi, parseLo} from "./entity/entity"
export type {Entity} from "./entity/entity"
export * as Hash from "./hash"
export {Changed, In, Is, Not, Out} from "./query/filter"
export type {Filter} from "./query/filter"
export {query} from "./query/query"
export type {Query} from "./query/query"
export * as Signal from "./signal"
export * as SparseMap from "./sparse/sparse_map"
export * as SparseSet from "./sparse/sparse_set"
export * as Commands from "./world/commands"
export {traverse_right as traverse} from "./world/graph"
export {makeWorld} from "./world/world"
export type {InitType as Init}
import type {Type} from "./data/type"
import type {Init} from "./world/commands"
import type {World} from "./world/world"
export type Data<T extends Type> = T extends Type<infer U> ? Init<U> : never
export type System = (world: World) => () => void

type InitType<U extends Type> = U extends Type<infer T> ? Init<T> : never
