export {run} from "./app/system"
export {Topology, relation, tag, value, valueRelation} from "./data/component"
export * from "./data/data"
export type {Entity} from "./entity/entity"
export {Changed, In, Is, Not, Out} from "./query/filter"
export {query} from "./query/query"
export {traverse} from "./world/graph"
export {make} from "./world/world"
export {type}
import type {Type} from "./data/type"
import {make as type} from "./data/type"
import type {Init} from "./world/commands"
import type {World} from "./world/world"
export type {
  ValueRelation as Relation,
  Tag,
  TagRelation,
  Value,
} from "./data/component"
export type {Filter} from "./query/filter"
export type {Query} from "./query/query"
export * as Signal from "./signal"
export * as Graph from "./world/graph"
// @ts-expect-error
export {DEBUG}
export type {Type, World}

export type Data<T extends Type> = T extends Type<infer U> ? Init<U> : never
export type System = (world: World) => () => void
