import * as Entity from "../entity/entity"

export type Changes = number[]
export type T = Changes

export let make = (): T => {
  return []
}

let get_at_key = (changes: Changes, key: number): number => {
  return (changes[key] ??= 0)
}

let make_key = (entity: Entity.T, component_id: number): number => {
  return Entity.make(Entity.parse_lo(entity), component_id)
}

export let get = (
  changes: Changes,
  entity: Entity.T,
  component_id: number,
): number => {
  let key = make_key(entity, component_id)
  return get_at_key(changes, key)
}

export let bump = (
  changes: Changes,
  entity: Entity.T,
  component_id: number,
): number => {
  let key = make_key(entity, component_id)
  return (changes[key] = get_at_key(changes, key) + 1)
}
