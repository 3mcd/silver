import * as Schema from "./schema"
import * as Type from "./type"
import {Brand} from "../types"
import * as Entity from "../entity/entity"

export enum Kind {
  Tag,
  TagRelation,
  TagPair,
  Ref,
  RefRelation,
  RefPair,
}

type Initializer<U = unknown> = (value: U) => U

export let Inclusive = "inclusive"
export let Exclusive = "exclusive"

export enum Topology {
  /**
   * A many-to-many relationship. This is the default topology for relations.
   * An entity may be related to any number of other entities through an
   * inclusive relation.
   */
  Inclusive,
  /**
   * A one-to-many relationship. An entity may have only one relationship to
   * another entity through an exclusive relation. This is useful for enforcing
   * a hierarchical topology, e.g. a tree structure where each entity may have
   * only one parent.
   */
  Exclusive,
}

export type Relatives<U extends T[], Out extends Entity.T[] = []> = U extends [
  infer Head,
  ...infer Tail,
]
  ? Tail extends T[]
    ? Relatives<
        Tail,
        Head extends RefRelation<unknown> | TagRelation
          ? [...Out, Entity.T]
          : Out
      >
    : never
  : Out

export type ValueOf<U extends T> = U extends TagRelation
  ? never
  : U extends RefRelation<infer V>
  ? V
  : U extends Tag
  ? never
  : U extends Ref<infer V>
  ? V
  : never

export type ValuesOf<U extends T[], Out extends unknown[] = []> = U extends []
  ? Out
  : U extends [infer Head, ...infer Tail]
  ? Tail extends T[]
    ? Head extends T
      ? ValuesOf<
          Tail,
          ValueOf<Head> extends never ? Out : [...Out, ValueOf<Head>]
        >
      : never
    : never
  : never

export interface Base<U> extends Brand<U> {
  kind: Kind
  id: number
}

/**
 * A component that has no data.
 */
export interface Tag extends Base<void> {
  kind: Kind.Tag
}

/**
 * A datatype that can be added to or removed from entities.
 */
export interface Ref<U = unknown> extends Base<U> {
  kind: Kind.Ref
  schema?: Schema.SchemaOf<U>
  initialize?: Initializer<any>
}

/**
 * A datatype that describes an entity's relationship to another entity.
 */
export interface RefRelation<U = unknown> extends Base<U> {
  kind: Kind.RefRelation
  schema?: Schema.SchemaOf<U>
  topology: Topology
  initialize?: Initializer<any>
}

/**
 * A zero-size datatype that describes an entity's relation to another entity.
 */
export interface TagRelation extends Base<void> {
  kind: Kind.TagRelation
  topology: Topology
}

export interface TagPair extends Base<void> {
  kind: Kind.TagPair
}

export interface RefPair extends Base<void> {
  kind: Kind.RefPair
}

export type TBase = Tag | Ref
export type TRef = Ref | RefRelation
export type TRelation = TagRelation | RefRelation
export type TPair = TagPair | RefPair
export type T = TBase | TRelation | TPair

let next_component_id = 1

export let make_component_id = () => {
  let component_id = next_component_id++
  Entity.assert_valid_hi(component_id)
  return component_id
}

let components = new Map<number, T>()

export let find_by_id = (component_id: number): T | undefined => {
  return components.get(component_id)
}

class Component {
  id
  kind
  schema?
  topology
  initialize?

  constructor(
    id: number,
    kind: Kind,
    topology?: Topology,
    schema?: Schema.T,
    initialize?: Initializer,
  ) {
    this.id = id
    this.kind = kind
    this.schema = schema
    this.topology = topology
    if (initialize) {
      this.initialize = initialize
    } else if (kind === Kind.Ref && schema) {
      this.initialize = Schema.initialize.bind(schema)
    }
  }
}

function make(id: number, kind: Kind.Tag, topology?: Topology): Tag
function make(
  id: number,
  kind: Kind.TagRelation,
  topology?: Topology,
): TagRelation
function make(id: number, kind: Kind.TagPair, topology?: Topology): TagPair
function make(
  id: number,
  kind: Kind.Ref,
  topology?: Topology,
  schema?: Schema.T,
  initialize?: Initializer,
): Ref
function make(
  id: number,
  kind: Kind.RefRelation,
  topology?: Topology,
  schema?: Schema.T,
  initialize?: Initializer,
): RefRelation
function make(id: number, kind: Kind.RefPair, topology?: Topology): RefPair
function make(
  id: number,
  kind: Kind,
  topology?: Topology,
  schema?: Schema.T,
  initialize?: Initializer,
): T {
  let component = new Component(id, kind, topology, schema, initialize) as T
  components.set(id, component)
  return new Component(id, kind, topology, schema, initialize) as T
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
    ? RecursivePartial<T[P]>
    : T[P]
}

/**
 * Define a component with a schema.
 *
 * The component is statically-typed and eligible for serialization and
 * auto-initialization.
 *
 * @example <caption>Define a component with a schema and add it to an entity.</caption>
 * let Position = S.ref({x: "f32", y: "f32"})
 * let entity = world.spawn(Position, {x: 0, y: 0})
 */
export function ref<U extends Schema.T>(
  schema: U,
  initialize?: Initializer<Schema.Express<U>>,
): Type.T<[Ref<Schema.Express<U>>]>
/**
 * Define a component using a generic type and schema. The schema must satisfy
 * the type provided to the generic parameter.
 *
 * The component is statically-typed and eligible for serialization and
 * auto-initialization.
 *
 * @example <caption>Define a component with a type-constrained schema and add it to an entity.</caption>
 * type Position = {
 *   x: number,
 *   y: number,
 * }
 * let Position = S.ref<Position>({x: "f32", y: "f32"}) // Value<Position>
 * let entity = world.spawn(Position, {x: 0, y: 0})
 */
export function ref<U>(
  schema: Schema.SchemaOf<RecursivePartial<U>>,
  initialize?: Initializer<U>,
): Type.T<[Ref<U>]>
/**
 * Define a schemaless component with a statically-typed shape.
 *
 * The component is not eligible for serialization and auto-initialization.
 *
 * @example <caption>Define a schemaless component and add it to an entity.</caption>
 * let Position = S.ref<Position>()
 * let entity = world.spawn(Position, {x: 0, y: 0})
 */
export function ref<U>(): Type.T<[Ref<U>]>
/**
 * Define a component with an undefined shape. The component's values will
 * be typed `unknown`.
 *
 * The component is **neither** statically-typed nor eligible for serialization and
 * auto-initialization.
 *
 * @example <caption>Define a schemaless component and add it to an entity.</caption>
 * let Anything = S.ref() // Value<unknown>
 * let entity = world.spawn(Anything, [[[]]])
 */
export function ref(): Type.T<[Ref<unknown>]>
export function ref(schema?: Schema.T | Initializer, initialize?: Initializer) {
  if (typeof schema === "function") {
    initialize = schema
    schema = undefined
  }
  return Type.make(
    make(make_component_id(), Kind.Ref, undefined, schema, initialize),
  )
}

/**
 * Define a tag. Tags are components with no data.
 *
 * @example <caption>Define a tag and add it to an entity.</caption>
 * let RedTeam = S.tag()
 * let entity = world.spawn(RedTeam)
 */
export let tag = (): Type.T<[Tag]> =>
  Type.make(make(make_component_id(), Kind.Tag))

/**
 * Define a relation using the given schema.
 *
 * The relation's data is statically-typed and eligible for serialization and
 * auto-initialization.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with a schema and add it to an entity.</caption>
 * let Orbits = S.relation({distance: "f32", period: "f32"})
 * let entity = world.spawn(Orbits, [sun, {distance: 10, period: 0.5}])
 */
export function ref_relation<U extends Schema.T>(
  schema: U,
  topology?: Topology,
): Type.T<[RefRelation<Schema.Express<U>>]>
/**
 * Define a relation using the given generic type and schema. The schema must satisfy
 * the type provided to the generic parameter.
 *
 * The relation's data is statically-typed and eligible for serialization and
 * auto-initialization.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with a type-constrained schema and add it to an entity.</caption>
 * let Owes = S.relation<number>("f32")
 * let entity = world.spawn(Owes, [bank, 1_000])
 */
export function ref_relation<U>(
  schema: Schema.SchemaOf<U>,
  topology?: Topology,
): Type.T<[RefRelation<U>]>
/**
 * Define a schemaless relation with a statically-typed shape.
 *
 * The relation's data is **not** eligible for serialization and
 * auto-initialization.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a typed but schemaless relation and add it to an entity.</caption>
 * let Owes = S.relation<number>()
 * let entity = world.spawn(Owes, [bank, 1_000])
 */
export function ref_relation<U>(topology?: Topology): Type.T<[RefRelation<U>]>
/**
 * Define a relation with an undefined shape.
 *
 * The relation's data is typed `unknown`.
 *
 * The relation's data is **neither** statically-typed nor eligible for
 * serialization and auto-initialization.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define an untyped relation and add it to an entity.</caption>
 * let OwesAnything = S.relation()
 * let entity = world.spawn(OwesAnything, [[[]]])
 */
export function ref_relation(
  topology?: Topology,
): Type.T<[RefRelation<unknown>]>
export function ref_relation(
  schema?: Schema.T | Topology,
  topology?: Topology,
) {
  let component_id = make_component_id()
  let component = make(
    component_id,
    Kind.RefRelation,
    (typeof schema === "number" ? schema : topology) ?? Topology.Inclusive,
    typeof schema === "number" ? undefined : schema,
  )
  return Type.make(component)
}

type RelationOptions = {
  exclusive?: boolean
}

type RelArg<T> = T extends "*"
  ? Type.T<[TagRelation]>
  : T extends Entity.T
  ? Type.T<[]>
  : never
type RefRel<U> = (
  entity_or_wildcard: Entity.T | "*",
) => Type.T<[RefRelation<U>]>

/**
 * Define a relation with no data.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with no data and add it to an entity.</caption>
 * let ChildOf = S.tag_relation()
 * let entity = world.spawn(ChildOf, [relative])
 */
export let rel = (options?: RelationOptions) => {
  let component_id = make_component_id()
  let component = make(
    component_id,
    Kind.TagRelation,
    options?.exclusive ? Topology.Exclusive : Topology.Inclusive,
  )
  let type = Type.make(component)
  let type_cache: Type.T[] = []
  return <T extends Entity.T | "*">(entity_or_wildcard: T): RelArg<T> => {
    if (entity_or_wildcard === "*") {
      return type as RelArg<T>
    }
    return (type_cache[entity_or_wildcard as Entity.T] ??= Type.make(
      type,
      make_pair(component, entity_or_wildcard),
    )) as RelArg<T>
  }
}

type PairsOf<U extends RefRelation | TagRelation> = U extends RefRelation
  ? RefPair
  : TagPair

export let make_pair = <U extends RefRelation | TagRelation>(
  component: U,
  entity: Entity.T,
): PairsOf<U> => {
  let component_id = Entity.make(Entity.parse_lo(entity), component.id)
  if (component.kind === Kind.TagRelation) {
    return make(component_id, Kind.TagPair) as PairsOf<U>
  } else {
    return make(component_id, Kind.RefPair) as PairsOf<U>
  }
}

export let references_value = (component: T): component is Ref | RefPair => {
  switch (component.kind) {
    case Kind.Ref:
    case Kind.RefPair:
      return true
    default:
      return false
  }
}

export let is_initialized = (component: T): boolean => {
  switch (component.kind) {
    case Kind.Ref:
    case Kind.RefRelation:
    case Kind.TagRelation:
      return true
    default:
      return false
  }
}

export let is_ref = (component: T): component is Ref =>
  component.kind === Kind.Ref

export let is_tag = (component: T): component is Tag | TagRelation =>
  component.kind === Kind.Tag || component.kind === Kind.TagRelation

export let is_tag_relation = (component: T): component is TagRelation =>
  component.kind === Kind.TagRelation

export let is_ref_relation = (component: T): component is RefRelation =>
  component.kind === Kind.RefRelation

export let is_relation = (
  component: T,
): component is RefRelation | TagRelation =>
  component.kind === Kind.TagRelation || component.kind === Kind.RefRelation

export let is_pair = (component: T): component is TPair =>
  component.kind === Kind.RefPair || component.kind === Kind.TagPair

export let is_ref_pair = (component: T): component is RefPair =>
  component.kind === Kind.RefPair

export let is_tag_pair = (component: T): component is TagPair =>
  component.kind === Kind.TagPair
