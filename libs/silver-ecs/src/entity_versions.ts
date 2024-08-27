import * as Entity from "./entity"

export type EntityVersions = number[]
export type T = EntityVersions

export let make = (): T => {
  return []
}

let get_at_key = (changes: EntityVersions, key: number): number => {
  return (changes[key] ??= 0)
}

let make_key = (entity: Entity.T, component_id: number): number => {
  return Entity.make(Entity.parse_lo(entity), component_id)
}

export let get = (
  changes: EntityVersions,
  entity: Entity.T,
  component_id: number,
): number => {
  return get_at_key(changes, make_key(entity, component_id))
}

export let bump = (
  changes: EntityVersions,
  entity: Entity.T,
  component_id: number,
): number => {
  let key = make_key(entity, component_id)
  return (changes[key] = get_at_key(changes, key) + 1)
}

export let set_at_key = (
  changes: EntityVersions,
  key: number,
  version: number,
): void => {
  changes[key] = version
}
