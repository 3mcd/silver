import type {Constraint} from "./system"

let anchors = new WeakSet<Function>()

let anchor = () => {
  function anchor() {}
  anchors.add(anchor)
  return anchor
}

class Range {
  #constraints
  #lo
  #hi
  constructor(constraints: Constraint[]) {
    this.#constraints = constraints
    this.#lo = anchor()
    this.#hi = anchor()
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
export let is_anchor = (object: Function): boolean => anchors.has(object)
