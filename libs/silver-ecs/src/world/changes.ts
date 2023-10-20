import * as Entity from "../entity/entity"

export type Changes = number[]
export type T = Changes

export const make = (): T => {
  return []
}

export const get = (changes: Changes, key: number): number => {
  return (changes[key] ??= 0)
}

export const bump = (changes: Changes, key: number): number => {
  return (changes[key] = get(changes, key) + 1)
}

export const make_key = (entity: Entity.T, component_id: number): number => {
  return Entity.make(Entity.parse_entity_id(entity), component_id)
}
