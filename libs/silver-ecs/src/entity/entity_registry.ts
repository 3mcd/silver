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

export const make = (
  head = 0,
  generations: number[] = [],
  free: number[] = [],
): T => new EntityRegistry(head, generations, free)

export const check = (registry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  const entityId = Entity.parseEntityId(entity)
  const entityGen = Entity.parseHi(entity)
  Assert.ok(
    checkGeneration(registry, entityId, entityGen),
    DEBUG && "Entity version is invalid. Was it deleted?",
  )
  return entityId
}

export const hydrate = (registry: T, entityId: number): Entity.T => {
  const entityGen = registry.generations[entityId] ?? 0
  return Entity.make(entityId, entityGen)
}

export const checkGeneration = (
  registry: T,
  entityId: number,
  entityGen: number,
) => {
  return registry.generations[entityId] === entityGen
}

export const retain = (registry: T): Entity.T => {
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

export const release = (registry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  const entityId = Entity.parseEntityId(entity)
  const entityGen = Entity.parseHi(entity)
  Assert.ok(
    checkGeneration(registry, entityId, entityGen),
    DEBUG && "Entity version is invalid. Was it deleted?",
  )
  // Recycle the entity id if the entity can be invalidated.
  if (entityGen < Entity.HI) {
    registry.free.push(entityId)
    registry.generations[entityId] = entityGen + 1
  }
}

export const rollback = (registry: T, entity: Entity.T) => {
  Entity.assertValid(entity)
  const entityId = Entity.parseEntityId(entity)
  const entityGen = Entity.parseHi(entity)
  registry.generations[entityId] = entityGen === 0 ? undefined! : entityGen - 1
  registry.free.push(entityId)
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")

  describe("entityRegistry", () => {
    it("allocates entities", () => {
      const registry = make()
      const entity = retain(registry)
      expect(check(registry, entity)).toBe(0)
    })

    it("invalidates freed entities", () => {
      const registry = make()
      const entity = retain(registry)
      release(registry, entity)
      expect(() => check(registry, entity)).toThrow()
    })

    it("recycles entity ids", () => {
      const registry = make()
      const entityA = retain(registry)
      release(registry, entityA)
      const entityB = retain(registry)
      expect(Entity.parseEntityId(entityA)).to.equal(
        Entity.parseEntityId(entityB),
      )
    })

    it("recycles generations", () => {
      const registry = make()
      const entityA = retain(registry)
      release(registry, entityA)
      const entityB = retain(registry)
      expect(Entity.parseHi(entityA)).to.equal(0)
      expect(Entity.parseHi(entityB)).to.equal(1)
    })

    it("throws when the limit of active registry is surpassed", () => {
      const registry = make(Entity.LO)
      expect(() => retain(registry)).not.to.throw()
      expect(() => retain(registry)).to.throw()
    })

    it("throws when an entity is freed twice", () => {
      const registry = make()
      const entity = retain(registry)
      release(registry, entity)
      expect(() => release(registry, entity)).to.throw()
    })

    it("does not recycle entity ids when they reach the maximum generation", () => {
      const registry = make(1, [Entity.HI])
      const entityA = Entity.make(0, Entity.HI)
      release(registry, entityA)
      const entityB = retain(registry)
      expect(Entity.parseEntityId(entityA)).not.to.equal(
        Entity.parseEntityId(entityB),
      )
    })

    it("throws when an entity is freed with an invalid entity", () => {
      const registry = make()
      expect(() => release(registry, -1 as Entity.T)).to.throw()
      expect(() =>
        release(registry, (Entity.EXTENT + 1) as Entity.T),
      ).to.throw()
    })

    it("throws when an entity is checked with an invalid entity", () => {
      const registry = make()
      expect(() => check(registry, -1 as Entity.T)).to.throw()
      expect(() => check(registry, (Entity.EXTENT + 1) as Entity.T)).to.throw()
    })

    it("rolls back an entity's generation", () => {
      const registry = make()
      const entity = retain(registry)
      rollback(registry, entity)
      expect(() => check(registry, entity)).toThrow()
      expect(retain(registry)).to.equal(entity)
    })
  })
}
