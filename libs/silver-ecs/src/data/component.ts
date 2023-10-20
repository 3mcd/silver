import * as Data from "./data"
import * as Type from "./type"
import {Brand} from "../types"
import * as Entity from "../entity/entity"

export enum Kind {
  Tag,
  Value,
  Relation,
  RelationTag,
  Relationship,
}

export type ValueOf<U extends T> = U extends RelationTag
  ? never
  : U extends Relation<infer V>
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
  schema?: Data.Schema_of<U>
}

/**
 * A datatype that describes an entity's relation to another entity.
 */
export interface Relation<U = unknown> extends Base<U> {
  kind: Kind.Relation
  schema?: Data.Schema_of<U>
}

/**
 * A zero-size datatype that describes an entity's relation to another entity.
 */
export interface RelationTag extends Base<void> {
  kind: Kind.RelationTag
}

export interface Relationship extends Base<void> {
  kind: Kind.Relationship
}

export type T = Value | Tag | Relation | RelationTag | Relationship

let next_component_id = 1
export const make_component_id = () => {
  const component_id = next_component_id++
  Entity.assert_valid_hi(component_id)
  return component_id
}

class Component {
  id: number
  kind: Kind
  schema?: Data.Schema

  constructor(id: number, kind: Kind, schema?: Data.Schema) {
    this.id = id
    this.kind = kind
    this.schema = schema
  }
}

function make<U extends Value>(
  id: number,
  kind: Kind.Value,
  schema?: Data.Schema,
): U
function make<U extends Tag>(id: number, kind: Kind.Tag): U
function make<U extends Relationship>(id: number, kind: Kind.Relationship): U
function make<U extends Relation>(
  id: number,
  kind: Kind.Relation,
  schema?: Data.Schema,
): U
function make<U extends RelationTag>(id: number, kind: Kind.RelationTag): U
function make(
  id: number,
  kind: Exclude<T, number>["kind"],
  schema?: Data.Schema,
): T {
  return new Component(id, kind, schema) as T
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
export function value<U>(schema: Data.Schema_of<U>): Type.Type<[Value<U>]>
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
  return Type.make(make(make_component_id(), Kind.Value, schema))
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
export function relation<U extends Data.Schema>(
  schema: U,
): Type.Type<[Relation<Data.Express<U>>]>
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
export function relation<U>(schema: Data.Schema_of<U>): Type.Type<[Relation<U>]>
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
export function relation<U>(): Type.Type<[Relation<U>]>
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
 * const Owes_anything = ecs.relation()
 * const entity = world.spawn(Owes_anything, [[[]]])
 */
export function relation(): Type.Type<[Relation<unknown>]>
export function relation(schema?: Data.Schema) {
  return Type.make(make(make_component_id(), Kind.Relation, schema))
}

/**
 * Define a relation with no data.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with no data and add it to an entity.</caption>
 * const ChildOf = ecs.relation_tag()
 * const entity = world.spawn(ChildOf, [parent])
 */
export const relation_tag = (): Type.Type<[RelationTag]> =>
  Type.make(make(make_component_id(), Kind.RelationTag))

export const make_relationship = (
  component: Relation | RelationTag,
  entity: Entity.T,
): Relationship =>
  make(
    Entity.make(Entity.parse_entity_id(entity), component.id),
    Kind.Relationship,
  )

export const is_value = (component: T): component is Value | Relation =>
  component.kind === Kind.Value || component.kind === Kind.Relation

export const is_relation = (
  component: T,
): component is Relation | RelationTag =>
  component.kind === Kind.Relation || component.kind === Kind.RelationTag

export const is_relationship = (component: T): component is Relationship =>
  component.kind === Kind.Relationship

export const is_tag = (component: T): component is Tag | RelationTag =>
  component.kind === Kind.Tag || component.kind === Kind.RelationTag

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")

  describe("is_value", () => {
    it("returns true for value components", () => {
      expect(is_value(value().components[0])).true
      expect(is_value(relation().components[0])).true
    })
    it("returns false for tag components", () => {
      expect(is_value(tag().components[0])).false
    })
  })

  describe("is_relation", () => {
    it("returns true for relation components", () => {
      expect(is_relation(relation().components[0])).true
    })
    it("returns false for tag components", () => {
      expect(is_relation(tag().components[0])).false
    })
  })

  describe("is_relationship", () => {
    it("returns true for relationship components", () => {
      expect(
        is_relationship(
          make_relationship(relation().component_spec[0], Entity.make(1, 2)),
        ),
      ).true
    })
    it("returns false for tag components", () => {
      expect(is_relationship(relation().components[0])).false
    })
  })

  describe("is_tag", () => {
    it("returns true for tag components", () => {
      expect(is_tag(tag().components[0])).true
    })
    it("returns false for value components", () => {
      expect(is_tag(value().components[0])).false
      expect(is_tag(relation().components[0])).false
    })
  })
}
