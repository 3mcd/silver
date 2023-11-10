export {run} from "./app/system"
export {Topology, relation, tag, value, valueRelation} from "./data/component"
export type {
  ValueRelation as Relation,
  Tag,
  TagRelation,
  Value,
} from "./data/component"
export * from "./data/data"
export {make as type} from "./data/type"
export type {Type} from "./data/type"
export type {Entity} from "./entity/entity"
export {Changed, In, Is, Not, Out} from "./query/filter"
export type {Filter} from "./query/filter"
export {query} from "./query/query"
export type {Query} from "./query/query"
export * as Signal from "./signal"
export {traverse} from "./world/graph"
export {make} from "./world/world"
export type {World} from "./world/world"
import type {Type} from "./data/type"
import type {Init} from "./world/commands"
import type {World} from "./world/world"

export type Data<T extends Type> = T extends Type<infer U> ? Init<U> : never
export type System = (world: World) => () => void
