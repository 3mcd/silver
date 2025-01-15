import * as Entity from "./entity"
import * as Buffer from "./buffer"

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

export const encode = (registry: T, buffer?: Buffer.T) => {
  let size = 4 + 4 + 4 + registry.dense.length * 4
  if (buffer === undefined) {
    buffer = Buffer.make(size)
  } else {
    Buffer.grow(buffer, size)
  }
  Buffer.write_u32(buffer, registry.next_entity_id)
  Buffer.write_u32(buffer, registry.alive_count)
  Buffer.write_u32(buffer, registry.dense.length)
  for (let i = 0; i < registry.dense.length; i++) {
    Buffer.write_u32(buffer, registry.dense[i])
  }
}

export const decode = (buffer: Buffer.T) => {
  let registry = make()
  registry.next_entity_id = Buffer.read_u32(buffer)
  registry.alive_count = Buffer.read_u32(buffer)
  let count = Buffer.read_u32(buffer)
  for (let i = 0; i < count; i++) {
    let entity = Buffer.read_u32(buffer) as Entity.T
    registry.dense.push(entity)
    registry.sparse[entity] = i
  }
  return registry
}
