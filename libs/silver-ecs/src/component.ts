import * as Entity from "./entity"
import * as Schema from "./schema"

export enum Kind {
  Tag,
  Ref,
  Rel,
  RelInverse,
  Pair,
}

type Initialize<U = unknown> = (value: U) => U

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

export interface Base<U> {
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
  initialize?: Initialize<any>
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

/**
 * A zero-size datatype that describes an entity's relation to another entity.
 */
export interface RelInverse extends Base<void> {
  kind: Kind.RelInverse
  topology: Topology
}

/**
 * A zero-size datatype that describes an entity's relation to another entity.
 */
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
  schema
  target?: RelInverse
  topology
  initialize

  constructor(
    id: number,
    kind: Kind,
    topology?: Topology,
    schema?: Schema.T,
    initialize?: Initialize,
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

const make_rel_target = (id: number, topology: Topology): RelInverse => {
  const rel_target = new Component(id, Kind.RelInverse, topology) as RelInverse
  components.set(id, rel_target)
  return rel_target
}

export function make(id: number, kind: Kind.Tag, topology?: Topology): Tag
export function make(id: number, kind: Kind.Rel, topology?: Topology): Rel
export function make(id: number, kind: Kind.Pair, topology?: Topology): Pair
export function make(
  id: number,
  kind: Kind.Ref,
  topology?: Topology,
  schema?: Schema.T,
  initialize?: Initialize,
): Ref
export function make(
  id: number,
  kind: Kind,
  topology?: Topology,
  schema?: Schema.T,
  initialize?: Initialize,
): T {
  let component = new Component(id, kind, topology, schema, initialize) as T
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
  initialize?: Initialize<Schema.Express<U>>,
): Ref<Schema.Express<U>>
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
  initialize?: Initialize<U>,
): Ref<U>
/**
 * Define a schemaless component with a statically-typed shape.
 *
 * The component is not eligible for serialization and auto-initialization.
 *
 * @example <caption>Define a schemaless component and add it to an entity.</caption>
 * let Position = S.ref<Position>()
 * let entity = world.spawn(Position, {x: 0, y: 0})
 */
export function ref<U>(): Ref<U>
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
export function ref(): Ref<unknown>
export function ref(schema?: Schema.T | Initialize, initialize?: Initialize) {
  if (typeof schema === "function") {
    initialize = schema
    schema = undefined
  }
  return make(make_component_id(), Kind.Ref, undefined, schema, initialize)
}

/**
 * Define a tag. Tags are components with no data.
 *
 * @example <caption>Define a tag and add it to an entity.</caption>
 * let RedTeam = S.tag()
 * let entity = world.spawn(RedTeam)
 */
export let tag = (): Tag => make(make_component_id(), Kind.Tag)

type RelOptions = {
  exclusive?: boolean
}
export interface PairFn {
  (): Rel
  (entity: Entity.T): Pair
}

/**
 * Define a relation with no data.
 *
 * Relations are used to describe an entity's relationship to another entity.
 *
 * @example <caption>Define a relation with no data and add it to an entity.</caption>
 * let ChildOf = S.tag_relation()
 * let entity = world.spawn(ChildOf, [relative])
 */
export let rel = (options?: RelOptions): PairFn => {
  let rel = make(
    make_component_id(),
    Kind.Rel,
    options?.exclusive ? Topology.Exclusive : Topology.Inclusive,
  )
  let rel_target = make_rel_target(make_component_id(), rel.topology)
  rel.inverse = rel_target
  let pair_cache: Pair[] = []
  function pair_fn(): Rel
  function pair_fn(entity: Entity.T): Pair
  function pair_fn(entity?: Entity.T) {
    if (entity === undefined) {
      return rel
    }
    let pair = pair_cache[entity]
    if (!pair) {
      pair = make_pair(rel, entity)
      pair_cache[entity] = pair
    }
    return pair
  }
  return pair_fn
}

export let make_pair = (component: Rel, entity: Entity.T): Pair => {
  let component_id = Entity.make(Entity.parse_lo(entity), component.id)
  return make(component_id, Kind.Pair)
}

export let is_initialized = (component: T): boolean => {
  switch (component.kind) {
    case Kind.Ref:
    case Kind.Rel:
      return true
    default:
      return false
  }
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
