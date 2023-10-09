import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"

export type InitRelationship<U> = [parent: Entity.T, value: U]

export type InitSingle<U extends Component.T> = U extends Component.RelationTag
  ? Entity.T
  : U extends Component.Relation<infer V>
  ? InitRelationship<V>
  : U extends Component.Value<infer V>
  ? V
  : never

export type Init<
  U extends Component.T[],
  Out extends unknown[] = [],
> = U extends []
  ? Out
  : U extends [infer Head, ...infer Tail]
  ? Tail extends Component.T[]
    ? Init<
        Tail,
        Head extends Component.T
          ? InitSingle<Head> extends never
            ? Out
            : [...Out, InitSingle<Head>]
          : never
      >
    : never
  : never

export interface Spawn<U extends Component.T[] = Component.T[]> {
  kind: "spawn"
  entity: Entity.T
  type: Type.T<U>
  init: Init<U>
}

export interface Despawn {
  kind: "despawn"
  entity: Entity.T
}

export interface Add<U extends Component.T[] = Component.T[]> {
  kind: "add"
  entity: Entity.T
  type: Type.T<U>
  init: Init<U>
}

export interface Remove<U extends Component.T[] = Component.T[]> {
  kind: "remove"
  entity: Entity.T
  type: Type.T<U>
}

export interface Link<
  U extends Component.Relation | Component.RelationTag =
    | Component.Relation
    | Component.RelationTag,
> {
  kind: "link"
  entity: Entity.T
  type: Type.Unitary<U>
  parent: Entity.T
  value?: U extends Component.Relation<infer V> ? V : never
}

export interface Unlink<
  U extends Component.Relation | Component.RelationTag =
    | Component.Relation
    | Component.RelationTag,
> {
  kind: "unlink"
  entity: Entity.T
  type: Type.Unitary<U>
  parent: Entity.T
}

export type T = Spawn | Despawn | Add | Remove | Link | Unlink

class Command {
  kind
  entity
  type?
  init?
  parent?

  constructor(
    kind: T["kind"],
    entity: Entity.T,
    type?: Type.T,
    init?: unknown,
    parent?: Entity.T,
  ) {
    this.kind = kind
    this.type = type
    this.entity = entity
    this.init = init
    this.parent = parent
  }
}

export const spawn = <U extends Component.T[]>(
  type: Type.T<U>,
  entity: Entity.T,
  init: Init<U>,
) => new Command("spawn", entity, type, init) as Spawn<U>

export const despawn = (entity: Entity.T) =>
  new Command("despawn", entity) as Despawn

export const add = <U extends Component.T[]>(
  type: Type.T<U>,
  entity: Entity.T,
  init: Init<U>,
) => new Command("add", entity, type, init) as Add<U>

export const remove = <U extends Component.T[]>(
  type: Type.T<U>,
  entity: Entity.T,
) => new Command("remove", entity, type) as Remove<U>

export const link = <U extends Component.Relation | Component.RelationTag>(
  entity: Entity.T,
  type: Type.Unitary<U>,
  parent: Entity.T,
  init?: U extends Component.Relation<infer V> ? V : never,
) => new Command("link", entity, type, init, parent) as Link<U>

export const unlink = <U extends Component.Relation | Component.RelationTag>(
  entity: Entity.T,
  type: Type.Unitary<U>,
  parent: Entity.T,
) => new Command("unlink", entity, type, parent) as Unlink<U>
