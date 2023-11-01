export {run} from "./app/system"
export {relation, tag, relation_tag, value, Topology} from "./data/component"
export * from "./data/data"
import type {World} from "./world/world"
import {make as type} from "./data/type"
export type {Entity} from "./entity/entity"
export {query} from "./query/query"
export {Changed, Not, In, Out} from "./query/filter"
export {traverse} from "./world/graph"
export {make} from "./world/world"
import type {Type} from "./data/type"
import type {Init} from "./world/commands"
export {type}
// @ts-expect-error
export {DEBUG}
export type {World}
export type {Query} from "./query/query"
export type {Type}
export type {Filter} from "./query/filter"
export type {
  Tag,
  Value,
  ValueRelation as Relation,
  TagRelation as RelationTag,
} from "./data/component"

export type Data<T extends Type> = T extends Type<infer U> ? Init<U> : never
export const Any = type()
export type System = (world: World) => () => void
