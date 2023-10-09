import * as Assert from "../assert"
import {Opaque} from "../types"

/**
 * The maximum number of spawned (alive) entities.
 */
export const MAX_EID = (1 << 19) - 1

// Entities are 31-bit unsigned integers with the following layout:
//
//   | 11-bit | 20-bit |
//   |--------|--------|
//   | gen    | id     |
//   |--------|--------|
//
// Entities are packed into 31 bits to fit into V8's Small Integer (SMI)
// type, which are not heap allocated.
//
// The entity id is used to index into component storage arrays, while the
// generation is used to invalidate destroyed entity "pointers".

/**
 * A unique identifier for a thing in the game world.
 */
declare const Entity: unique symbol
export type Entity = Opaque<number, typeof Entity>
export type T = Entity

export const LO_EXTENT = 20
export const LO = (1 << LO_EXTENT) - 1
export const HI_EXTENT = 31 - LO_EXTENT
export const HI = (1 << HI_EXTENT) - 1
export const EXTENT = Math.pow(2, 31) - 1

/**
 * Makes a new 31-bit entity from the given 20-bit id and 11-bit `hi` integer.
 */
export const make = (entityId: number, hi: number): Entity =>
  (((hi & HI) << LO_EXTENT) | entityId) as Entity

/**
 * Performs a bounds check on the given entity.
 */
export const assertValid = (entity: number) => {
  Assert.ok(entity >= 0, DEBUG && "Entity must be greater than or equal to 0")
  Assert.ok(
    entity <= EXTENT,
    DEBUG && `Entity must be less than or equal to ${EXTENT.toLocaleString()}`,
  )
}

/**
 * Performs a bounds check on the given entity id.
 */
export const assertValidId = (entityId: number) => {
  Assert.ok(
    entityId >= 0,
    DEBUG && "Entity id must be greater than or equal to 0",
  )
  Assert.ok(entityId <= LO, DEBUG && `Entity overflow`)
}

/**
 * Performs a bounds check on the given hi 11-bit integer.
 */
export const assertValidHi = (hi: number) => {
  Assert.ok(hi >= 1, DEBUG && "Hi value must greater than or equal to one")
  Assert.ok(
    hi <= HI,
    DEBUG &&
      "Component id or entity generation overflow. Did you create more than 2047 components?",
  )
}

/**
 * Extracts the entity id from the given entity.
 */
export const parseEntityId = (entity: number) => {
  assertValid(entity)
  return entity & LO
}

/**
 * Extracts the hi 11 bits from the given entity.
 */
export const parseHi = (entity: number) => {
  assertValid(entity)
  return entity >> LO_EXTENT
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")

  describe("parseId", () => {
    it("returns the entity id", () => {
      expect(parseEntityId(make(123, 456))).to.equal(123)
      expect(parseEntityId(make(1, 0))).to.equal(1)
      expect(parseEntityId(make(LO, 0))).to.equal(LO)
    })
    it("throws when the entity is invalid", () => {
      expect(() => parseEntityId(-1 as Entity)).to.throw()
      expect(() => parseEntityId((EXTENT + 1) as Entity)).to.throw()
    })
  })

  describe("parseHi", () => {
    it("returns the hi 11 bits of an entity", () => {
      expect(parseHi(make(123, 456))).to.equal(456)
      expect(parseHi(make(0, 2))).to.equal(2)
      expect(parseHi(make(0, HI))).to.equal(HI)
    })
    it("throws when the entity is invalid", () => {
      expect(() => parseHi(-1 as Entity)).to.throw()
      expect(() => parseHi((EXTENT + 1) as Entity)).to.throw()
    })
  })

  describe("assertValid", () => {
    it("does not throw when the entity is valid", () => {
      expect(() => assertValid(make(123, 456))).not.to.throw()
      expect(() => assertValid(make(0, 2))).not.to.throw()
      expect(() => assertValid(make(0, HI))).not.to.throw()
    })
    it("throws when the entity is invalid", () => {
      expect(() => assertValid(-1 as Entity)).to.throw()
      expect(() => assertValid((EXTENT + 1) as Entity)).to.throw()
    })
  })

  describe("assertValidId", () => {
    it("does not throw when the entity id is valid", () => {
      expect(() => assertValidId(123)).not.to.throw()
      expect(() => assertValidId(0)).not.to.throw()
      expect(() => assertValidId(LO)).not.to.throw()
    })
    it("throws when the entity id is invalid", () => {
      expect(() => assertValidId(-1)).to.throw()
      expect(() => assertValidId(EXTENT + 1)).to.throw()
    })
  })

  describe("assertValidHi", () => {
    it("does not throw when the hi value is valid", () => {
      expect(() => assertValidHi(1)).not.to.throw()
      expect(() => assertValidHi(HI)).not.to.throw()
    })
    it("throws when the hi value is invalid", () => {
      expect(() => assertValidHi(-1)).to.throw()
      expect(() => assertValidHi(0)).to.throw()
      expect(() => assertValidHi(HI + 1)).to.throw()
    })
  })
}
