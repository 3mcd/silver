import * as Entity from "../entity/entity"

export type Changes = number[]
export type T = Changes

export const make = (): T => {
  return []
}

const get_at_key = (changes: Changes, key: number): number => {
  return (changes[key] ??= 0)
}

const make_key = (entity: Entity.T, component_id: number): number => {
  return Entity.make(Entity.parse_entity_id(entity), component_id)
}

export const get = (
  changes: Changes,
  entity: Entity.T,
  component_id: number,
): number => {
  const key = make_key(entity, component_id)
  return get_at_key(changes, key)
}

export const bump = (
  changes: Changes,
  entity: Entity.T,
  component_id: number,
): number => {
  const key = make_key(entity, component_id)
  return (changes[key] = get_at_key(changes, key) + 1)
}
