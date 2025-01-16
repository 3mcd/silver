import {assert} from "./assert"
import * as Entity from "./entity"
import * as Schema from "./schema"

export enum Kind {
  Tag,
  Ref,
  Rel,
  RelInverse,
  Pair,
}

export enum Topology {
  Inclusive,
  Exclusive,
}

export interface Base<U> {
  kind: Kind
  id: number
}

export interface Tag extends Base<void> {
  kind: Kind.Tag
}

export interface Ref<U = unknown> extends Base<U> {
  kind: Kind.Ref
  schema?: Schema.SchemaOf<U>
}

export type ValueOf<U extends T> = U extends Ref<infer V> ? V : never
export type ValuesOf<U extends T[] = T[]> = U extends [
  infer Head,
  ...infer Tail extends T[],
]
  ? Head extends Ref
    ? [ValueOf<Head>, ...ValuesOf<Tail>]
    : ValuesOf<Tail>
  : []

export interface RelInverse extends Base<void> {
  kind: Kind.RelInverse
  topology: Topology
}
export interface Rel extends Base<void> {
  kind: Kind.Rel
  inverse: RelInverse
  topology: Topology
}

export interface Pair extends Base<void> {
  kind: Kind.Pair
}

export type T = Tag | Ref | Rel | RelInverse | Pair

let next_component_id = 1

const MAX_COMPONENT_ID = (1 << 21) - 1

let assert_valid_component_id = (component_id: number) => {
  assert(component_id <= MAX_COMPONENT_ID)
}

export let make_component_id = () => {
  let component_id = next_component_id++
  assert_valid_component_id(component_id)
  return component_id
}

let components = new Map<number, T>()

export let find_by_id = (component_id: number): T | undefined => {
  return components.get(component_id)
}

class Component {
  id
  kind
  schema
  target?: RelInverse
  topology

  constructor(id: number, kind: Kind, topology?: Topology, schema?: Schema.T) {
    this.id = id
    this.kind = kind
    this.schema = schema
    this.topology = topology
  }
}

export function make(id: number, kind: Kind.Tag, topology?: Topology): Tag
export function make(id: number, kind: Kind.Rel, topology?: Topology): Rel
export function make(
  id: number,
  kind: Kind.RelInverse,
  topology?: Topology,
): RelInverse
export function make(id: number, kind: Kind.Pair, topology?: Topology): Pair
export function make(
  id: number,
  kind: Kind.Ref,
  topology?: Topology,
  schema?: Schema.T,
): Ref
export function make(
  id: number,
  kind: Kind,
  topology?: Topology,
  schema?: Schema.T,
): T {
  let component = new Component(id, kind, topology, schema) as T
  components.set(id, component)
  return component
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
    ? RecursivePartial<T[P]>
    : T[P]
}

export function ref<U extends Schema.T>(schema: U): Ref<Schema.Express<U>>
export function ref<U>(schema: Schema.SchemaOf<RecursivePartial<U>>): Ref<U>
export function ref<U>(): Ref<U>
export function ref(): Ref<unknown>
export function ref(schema?: Schema.T) {
  return make(make_component_id(), Kind.Ref, undefined, schema)
}

export let tag = (): Tag => make(make_component_id(), Kind.Tag)

type RelOptions = {
  exclusive?: boolean
}

export interface PairFn {
  (): Rel
  (entity: Entity.T): Pair
}

export let rel = (options?: RelOptions): PairFn => {
  let rel_id = make_component_id()
  let rel_id_inverse = make_component_id()
  let rel_topology = options?.exclusive
    ? Topology.Exclusive
    : Topology.Inclusive
  let rel = make(rel_id, Kind.Rel, rel_topology)
  rel.inverse = make(rel_id_inverse, Kind.RelInverse, rel_topology)
  let pairs: Pair[] = []
  function pair_fn(): Rel
  function pair_fn(entity: Entity.T): Pair
  function pair_fn(entity?: Entity.T) {
    if (entity === undefined) {
      return rel
    }
    let pair = pairs[entity]
    if (!pair) {
      pair = pairs[entity] = make_pair(rel, entity)
    }
    return pair
  }
  return pair_fn
}

export let parse_pair_entity = (pair: Pair): Entity.T => {
  return (pair.id & 0x3fffffff) as Entity.T
}

export let parse_pair_rel_id = (pair: Pair): number => {
  return (pair.id - (pair.id & 0x3fffffff)) / 0x40000000
}

export let make_pair = (component: Rel, entity: Entity.T): Pair => {
  let component_id = component.id * 0x40000000 + entity
  return make(component_id, Kind.Pair)
}

export let is_ref = (component: T): component is Ref =>
  component.kind === Kind.Ref

export let is_tag = (component: T): component is Tag | Rel =>
  component.kind === Kind.Tag || component.kind === Kind.Rel

export let is_rel = (component: T): component is Rel =>
  component.kind === Kind.Rel

export let is_rel_exclusive = (component: T): component is Rel =>
  component.kind === Kind.Rel && component.topology === Topology.Exclusive

export let is_rel_inverse = (component: T): component is RelInverse =>
  component.kind === Kind.RelInverse

export let is_pair = (component: T): component is Pair =>
  component.kind === Kind.Pair

export let is_tag_pair = (component: T): component is Pair =>
  component.kind === Kind.Pair
