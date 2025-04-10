import * as Buffer from "./buffer"
import * as Entity from "./entity"

class EntityRegistry {
  next_entity_id = 0
  alive_count = 0
  dense = [] as Entity.T[]
  sparse = [] as number[]

  alloc(hi = 0) {
    if (this.alive_count !== this.dense.length) {
      return this.dense[this.alive_count++]
    }
    let entity = Entity.make(this.next_entity_id++, hi)
    let entity_index = this.dense.push(entity) - 1
    this.alive_count++
    this.sparse[entity] = entity_index
    return entity
  }

  free(entity: Entity.T) {
    let entity_index = this.sparse[entity]
    let last_alive_entity = this.dense[--this.alive_count]
    let last_alive_entity_index = this.sparse[last_alive_entity]
    this.dense[entity_index] = last_alive_entity
    this.dense[last_alive_entity_index] = entity
    this.sparse[entity] = last_alive_entity_index
    this.sparse[last_alive_entity] = entity_index
  }

  is_alive(entity: Entity.T) {
    return this.sparse[entity] < this.alive_count
  }

  check(entity: Entity.T) {
    if (!this.is_alive(entity)) {
      throw new Error(`Entity ${entity} is not alive`)
    }
  }
}

export type T = EntityRegistry

export let make = () => new EntityRegistry()

export let encode = (registry: EntityRegistry, buffer?: Buffer.T) => {
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
  let registry = new EntityRegistry()
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
