import * as Entity from "./entity"

export type EntityVersions = number[]
export type T = EntityVersions

export let make = (): T => {
  return []
}

let getAtKey = (changes: EntityVersions, key: number): number => {
  return (changes[key] ??= 0)
}

let makeKey = (entity: Entity.T, componentId: number): number => {
  return Entity.make(Entity.parseLo(entity), componentId)
}

export let get = (
  changes: EntityVersions,
  entity: Entity.T,
  componentId: number,
): number => {
  return getAtKey(changes, makeKey(entity, componentId))
}

export let bump = (
  changes: EntityVersions,
  entity: Entity.T,
  componentId: number,
): number => {
  let key = makeKey(entity, componentId)
  return (changes[key] = getAtKey(changes, key) + 1)
}

export let setAtKey = (
  changes: EntityVersions,
  key: number,
  version: number,
): void => {
  changes[key] = version
}
