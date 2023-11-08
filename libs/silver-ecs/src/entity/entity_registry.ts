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
  Entity.assert_valid(entity)
  let entity_id = Entity.parse_lo(entity)
  let entity_gen = Entity.parse_hi(entity)
  Assert.ok(
    check_generation(registry, entity_id, entity_gen),
    DEBUG && "Entity version is invalid. Was it deleted?",
  )
  return entity_id
}

export let hydrate = (registry: T, entity_id: number): Entity.T => {
  let entity_gen = registry.generations[entity_id] ?? 0
  return Entity.make(entity_id, entity_gen)
}

export let check_generation = (
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

export let rollback = (registry: T, entity: Entity.T) => {
  Entity.assert_valid(entity)
  let entity_id = Entity.parse_lo(entity)
  let entity_gen = Entity.parse_hi(entity)
  registry.generations[entity_id] =
    entity_gen === 0 ? undefined! : entity_gen - 1
  registry.free.push(entity_id)
}

if (import.meta.vitest) {
  let {describe, it, expect} = await import("vitest")

  describe("entity_registry", () => {
    it("allocates entities", () => {
      let registry = make()
      let entity = retain(registry)
      expect(check(registry, entity)).toBe(0)
    })

    it("invalidates freed entities", () => {
      let registry = make()
      let entity = retain(registry)
      release(registry, entity)
      expect(() => check(registry, entity)).toThrow()
    })

    it("recycles entity ids", () => {
      let registry = make()
      let entity_a = retain(registry)
      release(registry, entity_a)
      let entity_b = retain(registry)
      expect(Entity.parse_lo(entity_a)).to.equal(Entity.parse_lo(entity_b))
    })

    it("recycles generations", () => {
      let registry = make()
      let entity_a = retain(registry)
      release(registry, entity_a)
      let entity_b = retain(registry)
      expect(Entity.parse_hi(entity_a)).to.equal(0)
      expect(Entity.parse_hi(entity_b)).to.equal(1)
    })

    it("throws when the limit of active registry is surpassed", () => {
      let registry = make(Entity.LO)
      expect(() => retain(registry)).not.to.throw()
      expect(() => retain(registry)).to.throw()
    })

    it("throws when an entity is freed twice", () => {
      let registry = make()
      let entity = retain(registry)
      release(registry, entity)
      expect(() => release(registry, entity)).to.throw()
    })

    it("does not recycle entity ids when they reach the maximum generation", () => {
      let registry = make(1, [Entity.HI])
      let entity_a = Entity.make(0, Entity.HI)
      release(registry, entity_a)
      let entity_b = retain(registry)
      expect(Entity.parse_lo(entity_a)).not.to.equal(Entity.parse_lo(entity_b))
    })

    it("throws when an entity is freed with an invalid entity", () => {
      let registry = make()
      expect(() => release(registry, -1 as Entity.T)).to.throw()
      expect(() =>
        release(registry, (Entity.EXTENT + 1) as Entity.T),
      ).to.throw()
    })

    it("throws when an entity is checked with an invalid entity", () => {
      let registry = make()
      expect(() => check(registry, -1 as Entity.T)).to.throw()
      expect(() => check(registry, (Entity.EXTENT + 1) as Entity.T)).to.throw()
    })

    it("rolls back an entity's generation", () => {
      let registry = make()
      let entity = retain(registry)
      rollback(registry, entity)
      expect(() => check(registry, entity)).toThrow()
      expect(retain(registry)).to.equal(entity)
    })
  })
}
