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
  schema?: Data.SchemaOf<U>
}

/**
 * A datatype that describes an entity's relation to another entity.
 */
export interface Relation<U = unknown> extends Base<U> {
  kind: Kind.Relation
  schema?: Data.SchemaOf<U>
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

let nextComponentId = 1
export const makeComponentId = () => {
  const componentId = nextComponentId++
  Entity.assertValidHi(componentId)
  return componentId
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
 * Define a new component using the given schema. The shape of the component's
 * values is automatically derived from the schema.
 *
 * @example
 * const Position = ecs.Component.define({x: "f32", y: "f32"}) // Component<{ x: number, y: number }>
 */
export function value<U extends Data.Schema>(
  schema: U,
): Type.Type<[Value<Data.Express<U>>]>
/**
 * Define a new component using the given generic type and schema. The schema
 * will be statically compared to the provided type. Used to specify a named
 * type component values.
 *
 * @example
 * interface Position {
 *   x: number,
 *   y: number,
 * }
 * const Position = ecs.Component.define<Position>({x: "f32", y: "f32"}) // Component<Position>
 */
export function value<U>(schema: Data.SchemaOf<U>): Type.Type<[Value<U>]>
/**
 * Define a new component with an undefined shape. The component's values will
 * be typed `unknown`, and will be ineligible for serialization and
 * auto-initialization.
 *
 * @example
 * const Position = ecs.Component.define() // Component<unknown>
 */
export function value<U>(): Type.Type<[Value<U>]>
export function value(schema?: Data.Schema) {
  return Type.make(make(makeComponentId(), Kind.Value, schema))
}

/**
 * Define a new tag. Tags are components with no data.
 */
export const tag = (): Type.Type<[Tag]> =>
  Type.make(make(makeComponentId(), Kind.Tag))

/**
 * Define a new relation using the given schema.
 *
 * Relations are used to describe an entity's relationship to another entity.
 */
export function relation<U extends Data.Schema>(
  schema: U,
): Type.Type<[Relation<Data.Express<U>>]>
/**
 * Define a new relation using the given generic type and schema.
 *
 * Relations are used to describe an entity's relationship to another entity.
 */
export function relation<U>(schema: Data.SchemaOf<U>): Type.Type<[Relation<U>]>
/**
 * Define a new relation with an undefined shape. The relation's values will be
 * typed `unknown`, and will be ineligible for serialization and
 * auto-initialization.
 *
 * Relations are used to describe an entity's relationship to another entity.
 */
export function relation<U>(): Type.Type<[Relation<U>]>
export function relation(schema?: Data.Schema) {
  return Type.make(make(makeComponentId(), Kind.Relation, schema))
}

export const makeRelationship = (
  component: Relation | RelationTag,
  entity: Entity.T,
): Relationship =>
  make(
    Entity.make(Entity.parseEntityId(entity), component.id),
    Kind.Relationship,
  )

/**
 * Define a new tag. Tags are components with no data.
 */
export const tagRelation = (): Type.Type<[RelationTag]> =>
  Type.make(make(makeComponentId(), Kind.RelationTag))

export const isValue = (component: T): component is Value | Relation =>
  component.kind === Kind.Value || component.kind === Kind.Relation

export const isRelation = (component: T): component is Relation | RelationTag =>
  component.kind === Kind.Relation || component.kind === Kind.RelationTag

export const isRelationship = (component: T): component is Relationship =>
  component.kind === Kind.Relationship

export const isTag = (component: T): component is Tag | RelationTag =>
  component.kind === Kind.Tag || component.kind === Kind.RelationTag

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")

  describe("isValue", () => {
    it("returns true for value components", () => {
      expect(isValue(value().components[0])).true
      expect(isValue(relation().components[0])).true
    })
    it("returns false for tag components", () => {
      expect(isValue(tag().components[0])).false
    })
  })

  describe("isRelation", () => {
    it("returns true for relation components", () => {
      expect(isRelation(relation().components[0])).true
    })
    it("returns false for tag components", () => {
      expect(isRelation(tag().components[0])).false
    })
  })

  describe("isRelationship", () => {
    it("returns true for relationship components", () => {
      expect(
        isRelationship(
          makeRelationship(relation().componentSpec[0], Entity.make(1, 2)),
        ),
      ).true
    })
    it("returns false for tag components", () => {
      expect(isRelationship(relation().components[0])).false
    })
  })

  describe("isTag", () => {
    it("returns true for tag components", () => {
      expect(isTag(tag().components[0])).true
    })
    it("returns false for value components", () => {
      expect(isTag(value().components[0])).false
      expect(isTag(relation().components[0])).false
    })
  })
}
