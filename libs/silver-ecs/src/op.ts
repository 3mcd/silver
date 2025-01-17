import * as Component from "./component"
import * as Entity from "./entity"
import * as Type from "./type"

export enum Kind {
  Spawn,
  Despawn,
  Add,
  Remove,
}

export type Spawn = {
  kind: Kind.Spawn
  entity: Entity.T
  type: Type.T
  values: unknown[]
}

export type Despawn = {
  kind: Kind.Despawn
  type?: Type.T
  entity: Entity.T
}

export type Add = {
  kind: Kind.Add
  entity: Entity.T
  type: Type.T
  values: unknown[]
}

export type Remove = {
  kind: Kind.Remove
  entity: Entity.T
  type: Type.T
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
  type: Type.T,
  entity: Entity.T,
  values: Component.ValuesOf<U>,
) => {
  return new Op(Kind.Spawn, entity, type, values) as Spawn
}

export let despawn = (entity: Entity.T) => {
  return new Op(Kind.Despawn, entity) as Despawn
}

export let add = <U extends Component.T[]>(
  type: Type.T,
  entity: Entity.T,
  values: Component.ValuesOf<U>,
) => {
  return new Op(Kind.Add, entity, type, values) as Add
}

export let remove = (type: Type.T, entity: Entity.T) => {
  return new Op(Kind.Remove, entity, type) as Remove
}
