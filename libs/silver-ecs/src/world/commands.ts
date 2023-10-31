import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"

export type InitTagRelation = Entity.T[]
export type InitValueRelation<U = unknown> = [parent: Entity.T, value: U][]

export type InitSingle<U extends Component.T> = U extends Component.TagRelation
  ? InitTagRelation
  : U extends Component.ValueRelation<infer V>
  ? InitValueRelation<V>
  : U extends Component.Value<infer V>
  ? V
  : U extends Component.ValueRelationship
  ? unknown
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

export type Spawn<U extends Component.T[] = Component.T[]> = {
  kind: "spawn"
  entity: Entity.T
  type: Type.T<U>
  init: Init<U>
}

export type Despawn = {
  kind: "despawn"
  entity: Entity.T
}

export type Add<U extends Component.T[] = Component.T[]> = {
  kind: "add"
  entity: Entity.T
  type: Type.T<U>
  init: Init<U>
}

export type Remove<U extends Component.T[] = Component.T[]> = {
  kind: "remove"
  entity: Entity.T
  type: Type.T<U>
}

export type T = Spawn | Despawn | Add | Remove

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
