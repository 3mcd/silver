import * as Assert from "../assert"
import * as Entity from "./entity"

export class Entities {
  free
  generations
  head

  constructor(head: number, generations: number[], free: number[]) {
    this.free = free
    this.generations = generations
    this.head = head
  }
}
export type T = Entities

export let make = (
  head = 0,
  generations: number[] = [],
  free: number[] = [],
): T => new Entities(head, generations, free)

export let check = (entities: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  Assert.ok(checkGeneration(entities, entityId, entityGen))
  return entityId
}

export let checkFast = (entities: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  return checkGeneration(entities, entityId, entityGen)
}

export let hydrate = (entities: T, entityId: number): Entity.T => {
  let entityGen = entities.generations[entityId] ?? 0
  return Entity.make(entityId, entityGen)
}

export let checkGeneration = (
  entities: T,
  entityId: number,
  entityGen: number,
) => {
  return entities.generations[entityId] === entityGen
}

export let retain = (entities: T): Entity.T => {
  let entityId: number
  let entityGen: number
  if (entities.free.length > 0) {
    entityId = Assert.exists(entities.free.pop())
    entityGen = entities.generations[entityId] ?? 0
  } else {
    // Skip over reserved entity ids.
    while (entities.generations[entities.head] !== undefined) {
      entities.head++
    }
    Entity.assertValidId(entities.head)
    entityId = entities.head
    entityGen = entities.generations[entityId] = 0
  }
  return Entity.make(entityId, entityGen)
}

export let release = (entities: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  if (checkGeneration(entities, entityId, entityGen)) {
    // Recycle the entity id if the entity can be invalidated.
    if (entityGen < Entity.HI) {
      entities.free.push(entityId)
      entities.generations[entityId] = entityGen + 1
    }
  }
}

export let rollback = (entities: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  let entityId = Entity.parseLo(entity)
  let entityGen = Entity.parseHi(entity)
  entities.generations[entityId] = entityGen === 0 ? undefined! : entityGen - 1
  entities.free.push(entityId)
}
