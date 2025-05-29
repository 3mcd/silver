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

export let after = (a: Fn | Range.t) => (b: System) => {
  if (!(b instanceof System)) {
    b = make(b)
  }
  if (Range.is(a)) {
    b.after.add(a.hi())
  } else {
    b.after.add(a!)
  }
  return b
}

export let before = (b: Fn | Range.t) => (a: System) => {
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

export let when = (a: Criteria | Range.t) => (b: System) => {
  if (!(b instanceof System)) {
    b = make(b)
  }
  if (Range.is(a)) {
    b.after.add(a.lo())
    b.before.add(a.hi())
    b = apply_constraints(b, a.constraints())
  } else {
    b.when.push(a)
  }
  return b
}
