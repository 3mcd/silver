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
  is_rel as is_relation,
  is_tag,
  is_tag_pair,
  ref,
  ref_relation,
  references_value,
  rel,
  tag,
} from "./component"
export type {
  T as Component,
  Ref,
  RefPair,
  Tag,
  Rel as TagRelation,
} from "./component"
export * from "./schema"
export * as Schema from "./schema"
export {
  at as at,
  has as has_component,
  make as type,
  make as type_from_components,
} from "./sig"
export type {Sig as Type, Unitary} from "./sig"
export {parse_hi, parse_lo} from "./entity"
export type {Entity} from "./entity"
export * as Hash from "./hash"
export {Changed, In, Out, Is, Not} from "./filter"
export type {Filter} from "./filter"
export {make as query} from "./query_2"
export type {CompiledQuery as Query} from "./query"
export * as Signal from "./signal"
export * as SparseMap from "./sparse_map"
export * as SparseSet from "./sparse_set"
export * as Commands from "./op"
export {traverse_right as traverse} from "./graph"
export {make as makeWorld} from "./world"
export type {InitType as Init}
import type {Sig} from "./sig"
import type {Init} from "./op"
export type Data<T extends Sig> = T extends Sig<infer U> ? Init<U> : never

type InitType<U extends Sig> = U extends Sig<infer T> ? Init<T> : never
