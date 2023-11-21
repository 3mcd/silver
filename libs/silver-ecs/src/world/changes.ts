import * as Entity from "../entity/entity"

export type Changes = number[]
export type T = Changes

export let make = (): T => {
  return []
}

let getAtKey = (changes: Changes, key: number): number => {
  return (changes[key] ??= 0)
}

let makeKey = (entity: Entity.T, componentId: number): number => {
  return Entity.make(Entity.parseLo(entity), componentId)
}

export let get = (
  changes: Changes,
  entity: Entity.T,
  componentId: number,
): number => {
  let key = makeKey(entity, componentId)
  return getAtKey(changes, key)
}

export let bump = (
  changes: Changes,
  entity: Entity.T,
  componentId: number,
): number => {
  let key = makeKey(entity, componentId)
  return (changes[key] = getAtKey(changes, key) + 1)
}
