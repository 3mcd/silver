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
export const make = (entity_id: number, hi: number): Entity =>
  (((hi & HI) << LO_EXTENT) | entity_id) as Entity

/**
 * Performs a bounds check on the given entity.
 */
export const assert_valid = (entity: number) => {
  Assert.ok(entity >= 0, DEBUG && "Entity must be greater than or equal to 0")
  Assert.ok(
    entity <= EXTENT,
    DEBUG && `Entity must be less than or equal to ${EXTENT.toLocaleString()}`,
  )
}

/**
 * Performs a bounds check on the given entity id.
 */
export const assert_valid_id = (entity_id: number) => {
  Assert.ok(
    entity_id >= 0,
    DEBUG && "Entity id must be greater than or equal to 0",
  )
  Assert.ok(entity_id <= LO, DEBUG && `Entity overflow`)
}

/**
 * Performs a bounds check on the given hi 11-bit integer.
 */
export const assert_valid_hi = (hi: number) => {
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
export const parse_entity_id = (entity: number) => {
  assert_valid(entity)
  return entity & LO
}

/**
 * Extracts the hi 11 bits from the given entity.
 */
export const parse_hi = (entity: number) => {
  assert_valid(entity)
  return entity >> LO_EXTENT
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")

  describe("parse_id", () => {
    it("returns the entity id", () => {
      expect(parse_entity_id(make(123, 456))).to.equal(123)
      expect(parse_entity_id(make(1, 0))).to.equal(1)
      expect(parse_entity_id(make(LO, 0))).to.equal(LO)
    })
    it("throws when the entity is invalid", () => {
      expect(() => parse_entity_id(-1 as Entity)).to.throw()
      expect(() => parse_entity_id((EXTENT + 1) as Entity)).to.throw()
    })
  })

  describe("parse_hi", () => {
    it("returns the hi 11 bits of an entity", () => {
      expect(parse_hi(make(123, 456))).to.equal(456)
      expect(parse_hi(make(0, 2))).to.equal(2)
      expect(parse_hi(make(0, HI))).to.equal(HI)
    })
    it("throws when the entity is invalid", () => {
      expect(() => parse_hi(-1 as Entity)).to.throw()
      expect(() => parse_hi((EXTENT + 1) as Entity)).to.throw()
    })
  })

  describe("assert_valid", () => {
    it("does not throw when the entity is valid", () => {
      expect(() => assert_valid(make(123, 456))).not.to.throw()
      expect(() => assert_valid(make(0, 2))).not.to.throw()
      expect(() => assert_valid(make(0, HI))).not.to.throw()
    })
    it("throws when the entity is invalid", () => {
      expect(() => assert_valid(-1 as Entity)).to.throw()
      expect(() => assert_valid((EXTENT + 1) as Entity)).to.throw()
    })
  })

  describe("assert_valid_id", () => {
    it("does not throw when the entity id is valid", () => {
      expect(() => assert_valid_id(123)).not.to.throw()
      expect(() => assert_valid_id(0)).not.to.throw()
      expect(() => assert_valid_id(LO)).not.to.throw()
    })
    it("throws when the entity id is invalid", () => {
      expect(() => assert_valid_id(-1)).to.throw()
      expect(() => assert_valid_id(EXTENT + 1)).to.throw()
    })
  })

  describe("assert_valid_hi", () => {
    it("does not throw when the hi value is valid", () => {
      expect(() => assert_valid_hi(1)).not.to.throw()
      expect(() => assert_valid_hi(HI)).not.to.throw()
    })
    it("throws when the hi value is invalid", () => {
      expect(() => assert_valid_hi(-1)).to.throw()
      expect(() => assert_valid_hi(0)).to.throw()
      expect(() => assert_valid_hi(HI + 1)).to.throw()
    })
  })
}
