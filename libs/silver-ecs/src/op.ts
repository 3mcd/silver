import * as Component from "./component.ts"
import * as Entity from "./entity.ts"
import * as Type from "./type.ts"

export enum Kind {
  Spawn,
  Despawn,
  Add,
  Remove,
}

export type Spawn = {
  kind: Kind.Spawn
  entity: Entity.t
  type: Type.t
  values: unknown[]
}

export type Despawn = {
  kind: Kind.Despawn
  type?: Type.t
  entity: Entity.t
}

export type Add = {
  kind: Kind.Add
  entity: Entity.t
  type: Type.t
  values: unknown[]
}

export type Remove = {
  kind: Kind.Remove
  entity: Entity.t
  type: Type.t
}

export type t = Spawn | Despawn | Add | Remove

class Op {
  kind
  entity
  type?
  values?

  constructor(
    kind: t["kind"],
    entity: Entity.t,
    type?: Type.t,
    values?: unknown,
  ) {
    this.kind = kind
    this.entity = entity
    this.type = type
    this.values = values
  }
}

export let spawn = <U extends Component.t[]>(
  entity: Entity.t,
  type: Type.t,
  values: Component.ValuesOf<U>,
) => {
  return new Op(Kind.Spawn, entity, type, values) as Spawn
}

export let despawn = (entity: Entity.t) => {
  return new Op(Kind.Despawn, entity) as Despawn
}

export let add = (entity: Entity.t, type: Type.t, values: unknown[]) => {
  return new Op(Kind.Add, entity, type, values) as Add
}

export let remove = (entity: Entity.t, component: Component.t) => {
  return new Op(Kind.Remove, entity, Type.single(component)) as Remove
}
