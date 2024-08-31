import * as Entity from "./entity"

class EntityRegistry {
  next_entity_id = 0
  alive_count = 0
  dense = [] as Entity.T[]
  sparse = [] as number[]
}

export type T = EntityRegistry

export const make = () => new EntityRegistry()

export const alloc = (registry: T, hi = 0) => {
  if (registry.alive_count !== registry.dense.length) {
    return registry.dense[registry.alive_count++]
  }
  const entity = Entity.make(registry.next_entity_id++, hi)
  const entity_index = registry.dense.push(entity) - 1
  registry.alive_count++
  registry.sparse[entity] = entity_index
  return entity
}

export const free = (registry: T, entity: Entity.T) => {
  const entity_index = registry.sparse[entity]
  const last_alive_entity = registry.dense[--registry.alive_count]
  const last_alive_entity_index = registry.sparse[last_alive_entity]
  registry.dense[entity_index] = last_alive_entity
  registry.dense[last_alive_entity_index] = entity
  registry.sparse[entity] = last_alive_entity_index
  registry.sparse[last_alive_entity] = entity_index
}

export const is_alive = (registry: T, entity: Entity.T) => {
  return registry.sparse[entity] < registry.alive_count
}

export const check = (registry: T, entity: Entity.T) => {
  if (!is_alive(registry, entity)) {
    throw new Error(`Entity ${entity} is not alive`)
  }
}
