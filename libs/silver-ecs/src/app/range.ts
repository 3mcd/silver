import type {Constraint} from "./system"

const $is_anchor = Symbol()

let anchor = () => {
  function anchor() {}
  anchor[$is_anchor] = true
  return anchor
}

class Range {
  #constraints
  #min
  #max
  constructor(constraints: Constraint[]) {
    this.#constraints = constraints
    this.#min = anchor()
    this.#max = anchor()
  }

  min() {
    return this.#min
  }

  max() {
    return this.#max
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
export let is_anchor = (object: Function): boolean => $is_anchor in object
