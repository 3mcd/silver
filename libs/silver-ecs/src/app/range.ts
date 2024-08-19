import type {Constraint} from "./system"

const $is_range_anchor = Symbol()

let make_range_anchor = () => {
  function range_anchor() {}
  range_anchor[$is_range_anchor] = true
  return range_anchor
}

class Range {
  #constraints
  #lo
  #hi
  constructor(constraints: Constraint[]) {
    this.#constraints = constraints
    this.#lo = make_range_anchor()
    this.#hi = make_range_anchor()
  }

  lo() {
    return this.#lo
  }

  hi() {
    return this.#hi
  }

  constraints() {
    return this.#constraints
  }
}

export type T = Range

/* @__NO_SIDE_EFFECTS__ */
export let make = (...constraints: Constraint[]) => {
  return new Range(constraints)
}

export let is = (object: unknown): object is Range => object instanceof Range
export let is_anchor = (object: Function): boolean => $is_range_anchor in object
