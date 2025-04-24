import {assert} from "../assert.ts"
import * as Component from "../component.ts"
import * as Effect from "../effect.ts"
import * as World from "../world.ts"
import * as Schedule from "./schedule.ts"
import * as System from "./system.ts"

export class App {
  #init
  #init_schedule
  #schedule
  #world

  constructor(world = World.make(), schedule = Schedule.make()) {
    this.#init = true
    this.#init_schedule = Schedule.make()
    this.#world = world
    this.#schedule = schedule
  }

  use(plugin: Plugin): this
  use<T>(plugin: Plugin<T>, config: T): this
  use(plugin: Plugin<unknown>, config?: t): this {
    plugin(this, config)
    return this
  }

  run() {
    if (this.#init) {
      Schedule.run(this.#init_schedule, this.#world)
      this.#world.flush_ops()
      this.#init = false
    }
    Schedule.run(this.#schedule, this.#world)
    this.#world.flush_ops()
    return this
  }

  add_system(system: System.Fn, ...constraints: System.Constraint[]) {
    Schedule.add_system(
      this.#schedule,
      System.apply_constraints(system, constraints),
    )
    return this
  }

  add_init_system(system: System.Fn, ...constraints: System.Constraint[]) {
    Schedule.add_system(
      this.#init_schedule,
      System.apply_constraints(system, constraints),
    )
    return this
  }

  add_resource<U>(res: Component.Ref<U>, resource: U) {
    assert(this.#world.has_resource(res) === false)
    this.#world.set_resource(res, resource)
    return this
  }

  set_resource<U>(res: Component.Ref<U>, resource: U) {
    this.#world.set_resource(res, resource)
    return this
  }

  add_effect<const U extends Effect.Term[]>(effect: Effect.t<U>) {
    this.#world.add_effect(effect)
    return this
  }

  world() {
    return this.#world
  }

  /**
   * @internal
   */
  print_schedule() {
    return this.#schedule.systems.map(system => system.name).join("\n")
  }
}

export type t = App

export type Plugin<T = void> = T extends void
  ? (app: App) => void
  : (app: App, config: T) => void

export const make = (
  world: World.t = World.make(),
  schedule: Schedule.t = Schedule.make(),
) => new App(world, schedule)
