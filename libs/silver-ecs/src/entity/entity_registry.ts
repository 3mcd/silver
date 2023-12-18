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
): T => {
  return new EntityRegistry(head, generations, free)
}

export let check = (entityRegistry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  Assert.ok(checkGeneration(entityRegistry, entityId, entityGen))
  return entityId
}

export let checkFast = (entityRegistry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  return checkGeneration(entityRegistry, entityId, entityGen)
}

export let hydrate = (entityRegistry: T, entityId: number): Entity.T => {
  let entityGen = entityRegistry.generations[entityId] ?? 0
  return Entity.make(entityId, entityGen)
}

export let checkGeneration = (
  entityRegistry: T,
  entityId: number,
  entityGen: number,
) => {
  return entityRegistry.generations[entityId] === entityGen
}

export let retain = (entityRegistry: T): Entity.T => {
  let entityId: number
  let entityGen: number
  if (entityRegistry.free.length > 0) {
    entityId = Assert.exists(entityRegistry.free.pop())
    entityGen = entityRegistry.generations[entityId] ?? 0
  } else {
    // Skip over reserved entity ids.
    while (entityRegistry.generations[entityRegistry.head] !== undefined) {
      entityRegistry.head++
    }
    Entity.assertValidId(entityRegistry.head)
    entityId = entityRegistry.head
    entityGen = entityRegistry.generations[entityId] = 0
  }
  return Entity.make(entityId, entityGen)
}

export let release = (entityRegistry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  if (checkGeneration(entityRegistry, entityId, entityGen)) {
    // Recycle the entity id if the entity can be invalidated.
    if (entityGen < Entity.HI) {
      entityRegistry.free.push(entityId)
      entityRegistry.generations[entityId] = entityGen + 1
    }
  }
}

export let rollback = (entityRegistry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  entityRegistry.generations[entityId] =
    entityGen === 0 ? undefined! : entityGen - 1
  entityRegistry.free.push(entityId)
}
