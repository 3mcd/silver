import * as Assert from "./assert"
import * as Entity from "./entity"

export class EntityRegistry {
  free
  generations
  head

  constructor(head: number, generations: number[], free: number[]) {
    this.free = free
    this.generations = generations
    this.head = head
  }
}
export type T = EntityRegistry

export let make = (
  head = 0,
  generations: number[] = [],
  free: number[] = [],
): T => {
  return new EntityRegistry(head, generations, free)
}

export let check = (registry: T, entity: Entity.T) => {
  Entity.assert_valid(entity)
  let entity_id = Entity.parse_lo(entity)
  let entity_gen = Entity.parse_hi(entity)
  Assert.ok(checkGeneration(registry, entity_id, entity_gen))
  return entity_id
}

export let check_fast = (registry: T, entity: Entity.T) => {
  Entity.assert_valid(entity)
  let entity_id = Entity.parse_lo(entity)
  let entity_gen = Entity.parse_hi(entity)
  return checkGeneration(registry, entity_id, entity_gen)
}

export let hydrate = (registry: T, entity_id: number): Entity.T => {
  let entity_gen = registry.generations[entity_id] ?? 0
  return Entity.make(entity_id, entity_gen)
}

export let checkGeneration = (
  registry: T,
  entity_id: number,
  entity_gen: number,
) => {
  return registry.generations[entity_id] === entity_gen
}

export let retain = (registry: T): Entity.T => {
  let entity_id: number
  let entity_gen: number
  if (registry.free.length > 0) {
    entity_id = Assert.exists(registry.free.pop())
    entity_gen = registry.generations[entity_id] ?? 0
  } else {
    // Skip over reserved entity ids.
    while (registry.generations[registry.head] !== undefined) {
      registry.head++
    }
    Entity.assert_valid_id(registry.head)
    entity_id = registry.head
    entity_gen = registry.generations[entity_id] = 0
  }
  return Entity.make(entity_id, entity_gen)
}

export let release = (registry: T, entity: Entity.T) => {
  Entity.assert_valid(entity)
  let entity_id = Entity.parse_lo(entity)
  let entity_gen = Entity.parse_hi(entity)
  if (checkGeneration(registry, entity_id, entity_gen)) {
    // Recycle the entity id if the entity can be invalidated.
    if (entity_gen < Entity.HI) {
      registry.free.push(entity_id)
      registry.generations[entity_id] = entity_gen + 1
    }
  }
}

export let rollback = (registry: T, entity: Entity.T) => {
  Entity.assert_valid(entity)
  let entity_id = Entity.parse_lo(entity)
  let entity_gen = Entity.parse_hi(entity)
  registry.generations[entity_id] =
    entity_gen === 0 ? undefined! : entity_gen - 1
  registry.free.push(entity_id)
}
