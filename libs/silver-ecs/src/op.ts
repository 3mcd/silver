import * as Component from "./component"
import * as Entity from "./entity"
import * as Type from "./type"

export enum Kind {
  Spawn,
  Despawn,
  Add,
  Remove,
}

export type Spawn<U extends Component.T[] = Component.T[]> = {
  kind: Kind.Spawn
  entity: Entity.T
  type: Type.T<U>
  values: Component.ValuesOf<U>
}

export type Despawn = {
  kind: Kind.Despawn
  entity: Entity.T
}

export type Add<U extends Component.T[] = Component.T[]> = {
  kind: Kind.Add
  entity: Entity.T
  type: Type.T<U>
  values: Component.ValuesOf<U>
}

export type Remove<U extends Component.T[] = Component.T[]> = {
  kind: Kind.Remove
  entity: Entity.T
  type: Type.T<U>
}

export type T = Spawn | Despawn | Add | Remove

class Op {
  kind
  entity
  type?
  values?

  constructor(
    kind: T["kind"],
    entity: Entity.T,
    type?: Type.T,
    values?: unknown,
  ) {
    this.kind = kind
    this.entity = entity
    this.type = type
    this.values = values
  }
}

export let spawn = <U extends Component.T[]>(
  type: Type.T<U>,
  entity: Entity.T,
  values: Component.ValuesOf<U>,
) => {
  return new Op(Kind.Spawn, entity, type, values) as Spawn<U>
}

export let despawn = (entity: Entity.T) => {
  return new Op(Kind.Despawn, entity) as Despawn
}

export let add = <U extends Component.T[]>(
  type: Type.T<U>,
  entity: Entity.T,
  values: Component.ValuesOf<U>,
) => {
  return new Op(Kind.Add, entity, type, values) as Add<U>
}

export let remove = <U extends Component.T[]>(
  type: Type.T<U>,
  entity: Entity.T,
) => {
  return new Op(Kind.Remove, entity, type) as Remove<U>
}
