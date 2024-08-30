import * as World from "../world"
import * as Range from "./range"

export type Fn = (world: World.T) => void
export type Criteria = (world: World.T) => boolean | number
export type Constraint = (system: System) => System

export let apply_constraints = (
  system_or_fn: T | Fn,
  system_constraints: Constraint[],
) => {
  let system = is_system(system_or_fn) ? system_or_fn : make(system_or_fn)
  for (let i = 0; i < system_constraints.length; i++) {
    let system_constraint = system_constraints[i]
    system = system_constraint(system)
  }
  return system
}

class System {
  after = new Set<Fn>()
  before = new Set<Fn>()
  when: Criteria[] = []
  fn
  name
  constructor(fn: Fn) {
    this.fn = fn
    this.name = fn.name
  }
}

export type T = System

let systems = new WeakMap<Fn, System>()

export let make = (fn: Fn) => {
  let system = systems.get(fn)
  if (system === undefined) {
    system = new System(fn)
    systems.set(fn, system)
  }
  return system
}

export let is_system = (system: Fn | System): system is System =>
  system instanceof System

export let after = (a: Fn | Range.T) => (b: System) => _after(b, a)
export let before = (b: Fn | Range.T) => (a: System) => _before(a, b)
export let when = (a: Criteria | Range.T) => (b: System) => _when(b, a)

export let _after = (a: Fn | System, b: Fn | Range.T): System => {
  if (!(a instanceof System)) {
    a = make(a)
  }
  if (Range.is(b)) {
    a.after.add(b.max_anchor())
  } else {
    a.after.add(b!)
  }
  return a
}

export let _before = (a: Fn | System, b: Fn | Range.T): System => {
  if (!(a instanceof System)) {
    a = make(a)
  }
  if (Range.is(b)) {
    a.before.add(b.min_anchor())
  } else {
    a.before.add(b!)
  }
  return a
}

export let _when = (a: Fn | System, b: Criteria | Range.T): System => {
  if (!(a instanceof System)) {
    a = make(a)
  }
  if (Range.is(b)) {
    a.after.add(b.min_anchor())
    a.before.add(b.max_anchor())
    a = apply_constraints(a, b.constraints())
  } else {
    a.when.push(b)
  }
  return a
}
