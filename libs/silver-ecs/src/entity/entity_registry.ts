import * as Assert from "../assert"
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
): T => new EntityRegistry(head, generations, free)

export let check = (registry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  Assert.ok(checkGeneration(registry, entityId, entityGen))
  return entityId
}

export let hydrate = (registry: T, entityId: number): Entity.T => {
  let entityGen = registry.generations[entityId] ?? 0
  return Entity.make(entityId, entityGen)
}

export let checkGeneration = (
  registry: T,
  entityId: number,
  entityGen: number,
) => {
  return registry.generations[entityId] === entityGen
}

export let retain = (registry: T): Entity.T => {
  let entityId: number
  let entityGen: number
  if (registry.free.length > 0) {
    entityId = Assert.exists(registry.free.pop())
    entityGen = registry.generations[entityId] ?? 0
  } else {
    // Skip over reserved entity ids.
    while (registry.generations[registry.head] !== undefined) {
      registry.head++
    }
    Entity.assertValidId(registry.head)
    entityId = registry.head
    entityGen = registry.generations[entityId] = 0
  }
  return Entity.make(entityId, entityGen)
}

export let release = (registry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  Assert.ok(checkGeneration(registry, entityId, entityGen))
  // Recycle the entity id if the entity can be invalidated.
  if (entityGen < Entity.HI) {
    registry.free.push(entityId)
    registry.generations[entityId] = entityGen + 1
  }
}

export let rollback = (registry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  registry.generations[entityId] =
    entityGen === 0 ? undefined! : entityGen - 1
  registry.free.push(entityId)
}
