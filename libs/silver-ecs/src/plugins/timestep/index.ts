import {after, Plugin, range, when, App} from "../../app"
import * as World from "../../world"
import * as Clock from "../time"
import * as systems from "./systems"
import * as Timestep from "./timestep"
import * as Timestepper from "./timestepper"

export type Config = Timestepper.Config

let steps = (world: World.T) => world.get_resource(Timestep.res).steps()

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
    .add_system(systems.advance_timestep)
    .add_system(systems.increment_step, when(Clock.read), when(steps))
}

export let logical = range(
  after(systems.advance_timestep),
  after(systems.increment_step),
  when(steps),
)

export * from "./timestep"
