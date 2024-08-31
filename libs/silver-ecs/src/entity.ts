import * as Assert from "./assert"

/**
 * A unique identifier for a thing in the game world.
 */
export type T = number & {readonly _Entity__: true}

/**
 * The maximum number of spawned (alive) entities.
 */
export let LO_EXTENT = 20
export let LO = (1 << LO_EXTENT) - 1
export let HI_EXTENT = 31 - LO_EXTENT
export let HI = (1 << HI_EXTENT) - 1
export let EXTENT = Math.pow(2, 31) - 1

/**
 * Makes a new 31-bit entity from the given 20-bit id and 11-bit `hi` integer.
 */
export let make = (id: number, hi: number): T => {
  assert_valid_id(id)
  assert_valid_hi(hi)
  return (((hi & HI) << LO_EXTENT) | id) as T
}

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
export let assert_valid_id = (id: number) => {
  Assert.ok(id >= 0)
  Assert.ok(id <= LO)
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
