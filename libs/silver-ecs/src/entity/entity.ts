import * as Assert from "../assert"
import {Opaque} from "../types"

/**
 * The maximum number of spawned (alive) entities.
 */
export let MAX_EID = (1 << 19) - 1

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

export let LO_EXTENT = 20
export let LO = (1 << LO_EXTENT) - 1
export let HI_EXTENT = 31 - LO_EXTENT
export let HI = (1 << HI_EXTENT) - 1
export let EXTENT = Math.pow(2, 31) - 1

/**
 * Makes a new 31-bit entity from the given 20-bit id and 11-bit `hi` integer.
 */
export let make = (entity_id: number, hi: number): Entity =>
  (((hi & HI) << LO_EXTENT) | entity_id) as Entity

/**
 * Performs a bounds check on the given entity.
 */
export let assert_valid = (entity: number) => {
  Assert.ok(entity >= 0)
  Assert.ok(entity <= EXTENT)
}

/**
 * Performs a bounds check on the given entity id.
 */
export let assert_valid_id = (entity_id: number) => {
  Assert.ok(entity_id >= 0)
  Assert.ok(entity_id <= LO)
}

/**
 * Performs a bounds check on the given hi 11-bit integer.
 */
export let assert_valid_hi = (hi: number) => {
  Assert.ok(hi >= 1)
  Assert.ok(hi <= HI)
}

/**
 * Extracts the entity id from the given entity.
 */
export let parse_lo = (entity: number) => {
  assert_valid(entity)
  return entity & LO
}

/**
 * Extracts the hi 11 bits from the given entity.
 */
export let parse_hi = (entity: number) => {
  assert_valid(entity)
  return entity >> LO_EXTENT
}
