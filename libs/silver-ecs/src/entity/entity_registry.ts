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
  Entity.assert_valid(entity)
  const entity_id = Entity.parse_entity_id(entity)
  const entity_gen = Entity.parse_hi(entity)
  Assert.ok(
    check_generation(registry, entity_id, entity_gen),
    DEBUG && "Entity version is invalid. Was it deleted?",
  )
  return entity_id
}

export const hydrate = (registry: T, entity_id: number): Entity.T => {
  const entity_gen = registry.generations[entity_id] ?? 0
  return Entity.make(entity_id, entity_gen)
}

export const check_generation = (
  registry: T,
  entity_id: number,
  entity_gen: number,
) => {
  return registry.generations[entity_id] === entity_gen
}

export const retain = (registry: T): Entity.T => {
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

export const release = (registry: T, entity: Entity.T) => {
  Entity.assert_valid(entity)
  const entity_id = Entity.parse_entity_id(entity)
  const entity_gen = Entity.parse_hi(entity)
  Assert.ok(
    check_generation(registry, entity_id, entity_gen),
    DEBUG && "Entity version is invalid. Was it deleted?",
  )
  // Recycle the entity id if the entity can be invalidated.
  if (entity_gen < Entity.HI) {
    registry.free.push(entity_id)
    registry.generations[entity_id] = entity_gen + 1
  }
}

export const rollback = (registry: T, entity: Entity.T) => {
  Entity.assert_valid(entity)
  const entity_id = Entity.parse_entity_id(entity)
  const entity_gen = Entity.parse_hi(entity)
  registry.generations[entity_id] =
    entity_gen === 0 ? undefined! : entity_gen - 1
  registry.free.push(entity_id)
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")

  describe("entity_registry", () => {
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
      const entity_a = retain(registry)
      release(registry, entity_a)
      const entity_b = retain(registry)
      expect(Entity.parse_entity_id(entity_a)).to.equal(
        Entity.parse_entity_id(entity_b),
      )
    })

    it("recycles generations", () => {
      const registry = make()
      const entity_a = retain(registry)
      release(registry, entity_a)
      const entity_b = retain(registry)
      expect(Entity.parse_hi(entity_a)).to.equal(0)
      expect(Entity.parse_hi(entity_b)).to.equal(1)
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
      const entity_a = Entity.make(0, Entity.HI)
      release(registry, entity_a)
      const entity_b = retain(registry)
      expect(Entity.parse_entity_id(entity_a)).not.to.equal(
        Entity.parse_entity_id(entity_b),
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
