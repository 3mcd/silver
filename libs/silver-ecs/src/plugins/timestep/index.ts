import {after, App, before, range, when} from "../../app"
import * as World from "../../world"
import * as Time from "../time"
import * as systems from "./systems"
import * as Timestep from "./timestep"
import * as Timestepper from "./timestepper"

export type Config = Timestepper.Config

export let steps = (world: World.T) => world.get_resource(Timestep.res).steps()

let default_config: Config = {
  period: 1 / 60,
  max_update_delta_t: 0.25,
  max_drift_t: 1,
  overshoot: true,
}

export let plugin = (app: App, config?: Partial<Config>) => {
  let timestep_config = {...default_config, ...config}
  let timestep = Timestep.make(timestep_config)
  app
    .add_resource(Timestep.res, timestep)
    .add_system(systems.advance_timestep, when(update))
    .add_system(
      systems.increment_step,
      after(systems.advance_timestep),
      when(update),
      when(steps),
    )
}

export let update = range(when(Time.read))
export let fixed = range(
  after(systems.advance_timestep),
  before(systems.increment_step),
  when(update),
  when(steps),
)

export * from "./timestep"
