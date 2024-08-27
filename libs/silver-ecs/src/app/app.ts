import * as Assert from "../assert"
import * as World from "../world"
import * as Schedule from "./schedule"
import * as System from "./system"

class App {
  #init = true
  #init_schedule

  readonly schedule
  readonly world

  constructor(world = World.make(), schedule = Schedule.make()) {
    this.world = world
    this.schedule = schedule
    this.#init_schedule = Schedule.make()
  }

  use(plugin: Plugin): this
  use<T>(plugin: Plugin<T>, config: T): this
  use(plugin: Plugin<unknown>, config?: T): this {
    plugin(this, config)
    return this
  }

  run() {
    if (this.#init) {
      Schedule.run(this.#init_schedule, this.world)
      this.world.step()
      this.#init = false
    }
    Schedule.run(this.schedule, this.world)
    this.world.step()
  }

  add_system(system: System.Fn, ...constraints: System.Constraint[]) {
    Schedule.add_system(
      this.schedule,
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

  add_resource<T>(res: World.Res<T>, resource: T) {
    Assert.ok(this.world.has_resource(res) === false)
    this.world.set_resource(res, resource)
    return this
  }
}

export type T = App

export type Plugin<T = void> = T extends void
  ? (app: App) => void
  : (app: App, config: T) => void

export const make = (
  world: World.T = World.make(),
  schedule: Schedule.T = Schedule.make(),
) => new App(world, schedule)
