export * from "./app"
export {when, after, before} from "./app/system"
export * from "./world"

export {
  Topology,
  find_by_id as find_component_by_id,
  is_pair,
  is_ref,
  is_ref_pair,
  is_ref_relation,
  is_relation,
  is_tag,
  is_tag_pair,
  ref,
  ref_relation,
  references_value,
  rel,
  tag,
} from "./data/component"
export type {
  T as Component,
  Ref,
  RefPair,
  Tag,
  TagRelation,
} from "./data/component"
export * from "./data/schema"
export * as Schema from "./data/schema"
export {
  component_at as component_at,
  has as has_component,
  make as type,
  from as type_from_components,
} from "./data/type"
export type {Type, Unitary} from "./data/type"
export {parse_hi, parse_lo} from "./entity/entity"
export type {Entity} from "./entity/entity"
export * as Hash from "./hash"
export {Changed, In, Out, Is, Not} from "./query/filter"
export type {Filter} from "./query/filter"
export {query} from "./query/query"
export type {CompiledQuery as Query} from "./query/query"
export * as Signal from "./signal"
export * as SparseMap from "./sparse/sparse_map"
export * as SparseSet from "./sparse/sparse_set"
export * as Commands from "./world/op"
export {traverse_right as traverse} from "./world/graph"
export {make as makeWorld} from "./world/world"
export type {InitType as Init}
import type {Type} from "./data/type"
import type {Init} from "./world/op"
export type Data<T extends Type> = T extends Type<infer U> ? Init<U> : never

type InitType<U extends Type> = U extends Type<infer T> ? Init<T> : never
