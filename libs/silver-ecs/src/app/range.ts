import type {Constraint} from "./system.ts"

let anchors = new WeakSet<Function>()

let anchor = () => {
  function anchor() {}
  anchors.add(anchor)
  return anchor
}

/**
 * @internal
 */
export class Range {
  #constraints
  #lo
  #hi
  constructor(constraints: Constraint[]) {
    this.#constraints = constraints
    this.#lo = anchor()
    this.#hi = anchor()
  }

  /**
   * @internal
   */
  lo() {
    return this.#lo
  }

  /**
   * @internal
   */
  hi() {
    return this.#hi
  }

  /**
   * @internal
   */
  constraints() {
    return this.#constraints
  }
}

export type t = Range

/* @__NO_SIDE_EFFECTS__ */
export let make = (...constraints: Constraint[]) => {
  return new Range(constraints)
}

/**
 * @internal
 */
export let is = (object: unknown): object is Range => object instanceof Range
/**
 * @internal
 */
export let is_anchor = (object: Function): boolean => anchors.has(object)
