import {assert} from "./assert"

export type T = number & {readonly __entity__: true}

export let LO_EXTENT = 20
export let LO = (1 << LO_EXTENT) - 1
export let HI_EXTENT = 31 - LO_EXTENT
export let HI = (1 << HI_EXTENT) - 1
export let EXTENT = Math.pow(2, 31) - 1

export let make = (id: number, hi: number): T => {
  assert_valid_id(id)
  assert_valid_hi(hi)
  return (((hi & HI) << LO_EXTENT) | id) as T
}

export let assert_valid = (entity: number) => {
  assert(entity >= 0)
  assert(entity <= EXTENT)
}

export let assert_valid_id = (id: number) => {
  assert(id >= 0)
  assert(id <= LO)
}

export let assert_valid_hi = (hi: number) => {
  assert(hi >= 0)
  assert(hi <= HI)
}

export let parse_lo = (entity: number) => {
  assert_valid(entity)
  return entity & LO
}

export let parse_hi = (entity: number) => {
  assert_valid(entity)
  return entity >> LO_EXTENT
}
