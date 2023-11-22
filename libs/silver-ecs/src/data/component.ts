import * as Data from "./schema"
import * as Type from "./type"
import {Brand} from "../types"
import * as Entity from "../entity/entity"

export enum Kind {
  Tag,
  TagRelation,
  TagRelationship,
  Value,
  ValueRelation,
  ValueRelationship,
}

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
        Head extends ValueRelation<unknown> | TagRelation
          ? [...Out, Entity.T]
          : Out
      >
    : never
  : Out

export type ValueOf<U extends T> = U extends TagRelation
  ? never
  : U extends ValueRelation<infer V>
  ? V
  : U extends Tag
  ? never
  : U extends Value<infer V>
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
export interface Value<U = unknown> extends Base<U> {
  kind: Kind.Value
  schema?: Data.SchemaOf<U>
}

/**
 * A datatype that describes an entity's relationship to another entity.
 */
export interface ValueRelation<U = unknown> extends Base<U> {
  kind: Kind.ValueRelation
  schema?: Data.SchemaOf<U>
  topology: Topology
}

/**
 * A zero-size datatype that describes an entity's relation to another entity.
 */
export interface TagRelation extends Base<void> {
  kind: Kind.TagRelation
  topology: Topology
}

export interface TagRelationship extends Base<void> {
  kind: Kind.TagRelationship
}

export interface ValueRelationship extends Base<void> {
  kind: Kind.ValueRelationship
}

export type TBase = Tag | Value
export type TValue = Value | ValueRelation
export type TRelation = TagRelation | ValueRelation
export type TRelationship = TagRelationship | ValueRelationship
export type T = TBase | TRelation | TRelationship

let nextComponentId = 1
export let makeComponentId = () => {
  let componentId = nextComponentId++
  Entity.assertValidHi(componentId)
  return componentId
}

let relations = new Map<number, TRelation>()
export let getRelation = (componentId: number): TRelation | undefined => {
  return relations.get(componentId)
}

class Component {
  id
  kind
  schema?
  topology

  constructor(id: number, kind: Kind, topology?: Topology, schema?: Data.T) {
    this.id = id
    this.kind = kind
    this.schema = schema
    this.topology = topology
  }
}

function make(id: number, kind: Kind.Tag, topology?: Topology): Tag
function make(
  id: number,
  kind: Kind.TagRelation,
  topology?: Topology,
): TagRelation
function make(
  id: number,
  kind: Kind.TagRelationship,
  topology?: Topology,
): TagRelationship
function make(
  id: number,
  kind: Kind.Value,
  topology?: Topology,
  schema?: Data.T,
): Value
function make(
  id: number,
  kind: Kind.ValueRelation,
  topology?: Topology,
  schema?: Data.T,
): ValueRelation
function make(
  id: number,
  kind: Kind.ValueRelationship,
  topology?: Topology,
): ValueRelationship
function make(id: number, kind: Kind, topology?: Topology, schema?: Data.T): T {
  return new Component(id, kind, topology, schema) as T
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
 * let Position = ecs.value({x: "f32", y: "f32"})
 * let entity = world.spawn(Position, {x: 0, y: 0})
 */
export function value<U extends Data.T>(
  schema: U,
): Type.Type<[Value<Data.Express<U>>]>
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
 * let Position = ecs.value<Position>({x: "f32", y: "f32"}) // Value<Position>
 * let entity = world.spawn(Position, {x: 0, y: 0})
 */
export function value<U>(
  schema: Data.SchemaOf<RecursivePartial<U>>,
): Type.Type<[Value<U>]>
/**
 * Define a schemaless component with a statically-typed shape.
 *
 * The component is not eligible for serialization and auto-initialization.
 *
 * @example <caption>Define a schemaless component and add it to an entity.</caption>
 * let Position = ecs.value<Position>()
 * let entity = world.spawn(Position, {x: 0, y: 0})
 */
export function value<U>(): Type.Type<[Value<U>]>
/**
 * Define a component with an undefined shape. The component's values will
 * be typed `unknown`.
 *
 * The component is **neither** statically-typed nor eligible for serialization and
 * auto-initialization.
 *
 * @example <caption>Define a schemaless component and add it to an entity.</caption>
 * let Anything = ecs.value() // Value<unknown>
 * let entity = world.spawn(Anything, [[[]]])
 */
export function value(): Type.Type<[Value<unknown>]>
export function value(schema?: Data.T) {
  return Type.make(make(makeComponentId(), Kind.Value, undefined, schema))
}

/**
 * Define a tag. Tags are components with no data.
 *
 * @example <caption>Define a tag and add it to an entity.</caption>
 * let RedTeam = ecs.tag()
 * let entity = world.spawn(RedTeam)
 */
export let tag = (): Type.Type<[Tag]> =>
  Type.make(make(makeComponentId(), Kind.Tag))

/**
 * Define a relation using the given schema.
 *
 * The relation's data is statically-typed and eligible for serialization and
 * auto-initialization.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with a schema and add it to an entity.</caption>
 * let Orbits = ecs.relation({distance: "f32", period: "f32"})
 * let entity = world.spawn(Orbits, [sun, {distance: 10, period: 0.5}])
 */
export function valueRelation<U extends Data.T>(
  schema: U,
  topology?: Topology,
): Type.Type<[ValueRelation<Data.Express<U>>]>
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
 * let Owes = ecs.relation<number>("f32")
 * let entity = world.spawn(Owes, [bank, 1_000])
 */
export function valueRelation<U>(
  schema: Data.SchemaOf<U>,
  topology?: Topology,
): Type.Type<[ValueRelation<U>]>
/**
 * Define a schemaless relation with a statically-typed shape.
 *
 * The relation's data is **not** eligible for serialization and
 * auto-initialization.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a typed but schemaless relation and add it to an entity.</caption>
 * let Owes = ecs.relation<number>()
 * let entity = world.spawn(Owes, [bank, 1_000])
 */
export function valueRelation<U>(
  topology?: Topology,
): Type.Type<[ValueRelation<U>]>
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
 * let OwesAnything = ecs.relation()
 * let entity = world.spawn(OwesAnything, [[[]]])
 */
export function valueRelation(
  topology?: Topology,
): Type.Type<[ValueRelation<unknown>]>
export function valueRelation(schema?: Data.T | Topology, topology?: Topology) {
  let componentId = makeComponentId()
  let component = make(
    componentId,
    Kind.ValueRelation,
    (typeof schema === "number" ? schema : topology) ?? Topology.Inclusive,
    typeof schema === "number" ? undefined : schema,
  )
  relations.set(componentId, component)
  return Type.make(component)
}

/**
 * Define a relation with no data.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with no data and add it to an entity.</caption>
 * let ChildOf = ecs.tagRelation()
 * let entity = world.spawn(ChildOf, [relative])
 */
export let relation = (
  topology = Topology.Inclusive,
): Type.Type<[TagRelation]> => {
  let componentId = makeComponentId()
  let component = make(componentId, Kind.TagRelation, topology)
  relations.set(componentId, component)
  return Type.make(component)
}

type RelationshipOf<U extends ValueRelation | TagRelation> =
  U extends ValueRelation ? ValueRelationship : TagRelationship

export let makeRelationship = <U extends ValueRelation | TagRelation>(
  component: U,
  entity: Entity.T,
): RelationshipOf<U> => {
  let componentId = Entity.make(Entity.parseLo(entity), component.id)
  if (component.kind === Kind.TagRelation) {
    return make(componentId, Kind.TagRelationship) as RelationshipOf<U>
  } else {
    return make(componentId, Kind.ValueRelationship) as RelationshipOf<U>
  }
}

export let storesValue = (
  component: T,
): component is Value | ValueRelationship => {
  switch (component.kind) {
    case Kind.Value:
    case Kind.ValueRelationship:
      return true
    default:
      return false
  }
}

export let isValue = (component: T): component is Value =>
  component.kind === Kind.Value

export let isInitialized = (component: T): boolean => {
  switch (component.kind) {
    case Kind.Value:
    case Kind.ValueRelation:
    case Kind.TagRelation:
      return true
    default:
      return false
  }
}

export let isTagRelation = (component: T): component is TagRelation =>
  component.kind === Kind.TagRelation

export let isValueRelation = (component: T): component is ValueRelation =>
  component.kind === Kind.ValueRelation

export let isRelation = (
  component: T,
): component is ValueRelation | TagRelation =>
  component.kind === Kind.TagRelation || component.kind === Kind.ValueRelation

export let isRelationship = (component: T): component is TRelationship =>
  component.kind === Kind.ValueRelationship ||
  component.kind === Kind.TagRelationship

export let isValueRelationship = (
  component: T,
): component is ValueRelationship => component.kind === Kind.ValueRelationship

export let isTagRelationship = (component: T): component is TagRelationship =>
  component.kind === Kind.TagRelationship

export let isTag = (component: T): component is Tag | TagRelation =>
  component.kind === Kind.Tag || component.kind === Kind.TagRelation
