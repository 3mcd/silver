import * as Data from "./data"
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

export enum Topology {
  Any,
  Hierarchical,
}

export type Related<U extends T[], Out extends Entity.T[] = []> = U extends [
  infer Head,
  ...infer Tail,
]
  ? Tail extends T[]
    ? Related<
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
      ? ValuesOf<Tail, [...Out, ValueOf<Head>]>
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
export type TRelation = TagRelation | ValueRelation
export type TRelationship = TagRelationship | ValueRelationship
export type T = TBase | TRelation | TRelationship

let next_component_id = 1
export const make_component_id = () => {
  const component_id = next_component_id++
  Entity.assert_valid_hi(component_id)
  return component_id
}

const relations = new Map<number, TRelation>()
export const get_relation = (component_id: number): TRelation | undefined => {
  return relations.get(component_id)
}

class Component {
  id
  kind
  schema?
  topology

  constructor(
    id: number,
    kind: Kind,
    topology?: Topology,
    schema?: Data.Schema,
  ) {
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
  schema?: Data.Schema,
): Value
function make(
  id: number,
  kind: Kind.ValueRelation,
  topology?: Topology,
  schema?: Data.Schema,
): ValueRelation
function make(
  id: number,
  kind: Kind.ValueRelationship,
  topology?: Topology,
): ValueRelationship
function make(
  id: number,
  kind: Kind,
  topology?: Topology,
  schema?: Data.Schema,
): T {
  return new Component(id, kind, topology, schema) as T
}

/**
 * Define a component with a schema.
 *
 * The component is statically-typed and eligible for serialization and
 * auto-initialization.
 *
 * @example <caption>Define a component with a schema and add it to an entity.</caption>
 * const Position = ecs.value({x: "f32", y: "f32"})
 * const entity = world.spawn(Position, {x: 0, y: 0})
 */
export function value<U extends Data.Schema>(
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
 * const Position = ecs.value<Position>({x: "f32", y: "f32"}) // Value<Position>
 * const entity = world.spawn(Position, {x: 0, y: 0})
 */
export function value<U>(schema: Data.SchemaOf<U>): Type.Type<[Value<U>]>
/**
 * Define a schemaless component with a statically-typed shape.
 *
 * The component is not eligible for serialization and auto-initialization.
 *
 * @example <caption>Define a schemaless component and add it to an entity.</caption>
 * const Position = ecs.value<Position>()
 * const entity = world.spawn(Position, {x: 0, y: 0})
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
 * const Anything = ecs.value() // Value<unknown>
 * const entity = world.spawn(Anything, [[[]]])
 */
export function value(): Type.Type<[Value<unknown>]>
export function value(schema?: Data.Schema) {
  return Type.make(make(make_component_id(), Kind.Value, undefined, schema))
}

/**
 * Define a tag. Tags are components with no data.
 *
 * @example <caption>Define a tag and add it to an entity.</caption>
 * const Red_team = ecs.tag()
 * const entity = world.spawn(Red_team)
 */
export const tag = (): Type.Type<[Tag]> =>
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
 * const Orbits = ecs.relation({distance: "f32", period: "f32"})
 * const entity = world.spawn(Orbits, [sun, {distance: 10, period: 0.5}])
 */
export function valueRelation<U extends Data.Schema>(
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
 * const Owes = ecs.relation<number>("f32")
 * const entity = world.spawn(Owes, [bank, 1_000])
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
 * const Owes = ecs.relation<number>()
 * const entity = world.spawn(Owes, [bank, 1_000])
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
 * const OwesAnything = ecs.relation()
 * const entity = world.spawn(OwesAnything, [[[]]])
 */
export function valueRelation(
  topology?: Topology,
): Type.Type<[ValueRelation<unknown>]>
export function valueRelation(
  schema?: Data.Schema | Topology,
  topology?: Topology,
) {
  const component_id = make_component_id()
  const component = make(
    component_id,
    Kind.ValueRelation,
    (typeof schema === "number" ? schema : topology) ?? Topology.Any,
    typeof schema === "number" ? undefined : schema,
  )
  relations.set(component_id, component)
  return Type.make(component)
}

/**
 * Define a relation with no data.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with no data and add it to an entity.</caption>
 * const ChildOf = ecs.tagRelation()
 * const entity = world.spawn(ChildOf, [relative])
 */
export const relation = (topology = Topology.Any): Type.Type<[TagRelation]> => {
  const component_id = make_component_id()
  const component = make(component_id, Kind.TagRelation, topology)
  relations.set(component_id, component)
  return Type.make(component)
}

type RelationshipOf<U extends ValueRelation | TagRelation> =
  U extends ValueRelation ? ValueRelationship : TagRelationship

export const make_relationship = <U extends ValueRelation | TagRelation>(
  component: U,
  entity: Entity.T,
): RelationshipOf<U> => {
  const component_id = Entity.make(Entity.parse_entity_id(entity), component.id)
  if (component.kind === Kind.TagRelation) {
    return make(component_id, Kind.TagRelationship) as RelationshipOf<U>
  } else {
    return make(component_id, Kind.ValueRelationship) as RelationshipOf<U>
  }
}

export const wraps_value = (component: T): boolean => {
  switch (component.kind) {
    case Kind.Value:
    case Kind.ValueRelationship:
      return true
    default:
      return false
  }
}

export const is_value = (component: T): component is Value =>
  component.kind === Kind.Value

export const is_initialized = (component: T): boolean => {
  switch (component.kind) {
    case Kind.Value:
    case Kind.ValueRelation:
    case Kind.TagRelation:
      return true
    default:
      return false
  }
}

export const is_tag_relation = (component: T): component is TagRelation =>
  component.kind === Kind.TagRelation

export const is_value_relation = (component: T): component is ValueRelation =>
  component.kind === Kind.ValueRelation

export const is_relation = (
  component: T,
): component is ValueRelation | TagRelation =>
  component.kind === Kind.TagRelation || component.kind === Kind.ValueRelation

export const is_relationship = (component: T): component is TRelationship =>
  component.kind === Kind.ValueRelationship ||
  component.kind === Kind.TagRelationship

export const is_value_relationship = (
  component: T,
): component is ValueRelationship => component.kind === Kind.ValueRelationship

export const is_tag = (component: T): component is Tag | TagRelation =>
  component.kind === Kind.Tag || component.kind === Kind.TagRelation

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")

  describe("is_value", () => {
    it("returns true for value components", () => {
      expect(is_value(value().components[0])).true
    })
    it("returns false for tag components", () => {
      expect(is_value(tag().components[0])).false
    })
  })

  describe("is_relation", () => {
    it("returns true for relation components", () => {
      expect(is_relation(valueRelation().components[0])).true
    })
    it("returns false for tag components", () => {
      expect(is_relation(tag().components[0])).false
    })
  })

  describe("is_relationship", () => {
    it("returns true for relationship components", () => {
      expect(
        is_value_relationship(
          make_relationship(
            valueRelation().component_spec[0],
            Entity.make(1, 2),
          ),
        ),
      ).true
    })
    it("returns false for tag components", () => {
      expect(is_value_relationship(valueRelation().components[0])).false
    })
  })

  describe("is_tag", () => {
    it("returns true for tag components", () => {
      expect(is_tag(tag().components[0])).true
    })
    it("returns false for value components", () => {
      expect(is_tag(value().components[0])).false
      expect(is_tag(valueRelation().components[0])).false
    })
  })
}
