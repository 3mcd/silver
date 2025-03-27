import * as Buffer from "./buffer"
import * as Entity from "./entity"

class EntityRegistry {
  next_entity_id = 0
  alive_count = 0
  dense = [] as Entity.T[]
  sparse = [] as number[]
}

export type T = EntityRegistry

export let make = () => new EntityRegistry()

export let alloc = (registry: T, hi = 0) => {
  if (registry.alive_count !== registry.dense.length) {
    return registry.dense[registry.alive_count++]
  }
  let entity = Entity.make(registry.next_entity_id++, hi)
  let entity_index = registry.dense.push(entity) - 1
  registry.alive_count++
  registry.sparse[entity] = entity_index
  return entity
}

export let free = (registry: T, entity: Entity.T) => {
  let entity_index = registry.sparse[entity]
  let last_alive_entity = registry.dense[--registry.alive_count]
  let last_alive_entity_index = registry.sparse[last_alive_entity]
  registry.dense[entity_index] = last_alive_entity
  registry.dense[last_alive_entity_index] = entity
  registry.sparse[entity] = last_alive_entity_index
  registry.sparse[last_alive_entity] = entity_index
}

export let is_alive = (registry: T, entity: Entity.T) => {
  return registry.sparse[entity] < registry.alive_count
}

export let check = (registry: T, entity: Entity.T) => {
  if (!is_alive(registry, entity)) {
    throw new Error(`Entity ${entity} is not alive`)
  }
}

export let encode = (registry: T, buffer?: Buffer.T) => {
  let size = 4 + 4 + 4 + registry.dense.length * 4
  if (buffer === undefined) {
    buffer = Buffer.make(size)
  } else {
    buffer.grow(size)
  }
  buffer.write_u32(registry.next_entity_id)
  buffer.write_u32(registry.alive_count)
  buffer.write_u32(registry.dense.length)
  for (let i = 0; i < registry.dense.length; i++) {
    buffer.write_u32(registry.dense[i])
  }
}

export let decode = (buffer: Buffer.T) => {
  let registry = make()
  registry.next_entity_id = buffer.read_u32()
  registry.alive_count = buffer.read_u32()
  let count = buffer.read_u32()
  for (let i = 0; i < count; i++) {
    let entity = buffer.read_u32() as Entity.T
    registry.dense.push(entity)
    registry.sparse[entity] = i
  }
  return registry
}
