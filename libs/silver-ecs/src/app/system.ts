import * as World from "../world.ts"
import * as Range from "./range.ts"

export type Fn = (world: World.t) => void
export type Criteria = (world: World.t) => boolean | number
export type Constraint = (system: System) => System

export let apply_constraints = (
  system_or_fn: t | Fn,
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

export type t = System

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

let _after = (a: Fn | System, b: Fn | Range.t): System => {
  if (!(a instanceof System)) {
    a = make(a)
  }
  if (Range.is(b)) {
    a.after.add(b.hi())
  } else {
    a.after.add(b!)
  }
  return a
}

let _before = (a: Fn | System, b: Fn | Range.t): System => {
  if (!(a instanceof System)) {
    a = make(a)
  }
  if (Range.is(b)) {
    a.before.add(b.lo())
  } else {
    a.before.add(b!)
  }
  return a
}

let _when = (a: Fn | System, b: Criteria | Range.t): System => {
  if (!(a instanceof System)) {
    a = make(a)
  }
  if (Range.is(b)) {
    a.after.add(b.lo())
    a.before.add(b.hi())
    a = apply_constraints(a, b.constraints())
  } else {
    a.when.push(b)
  }
  return a
}

export let after = (a: Fn | Range.t) => (b: System) => _after(b, a)
export let before = (b: Fn | Range.t) => (a: System) => _before(a, b)
export let when = (a: Criteria | Range.t) => (b: System) => _when(b, a)
