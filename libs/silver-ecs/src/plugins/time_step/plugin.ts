import {after, App, before, range, when} from "#app/index"
import * as Time from "#plugins/time/plugin"
import * as World from "#world"
import * as Timestepper from "./stepper"
import {advance_timestep} from "./systems/advance_timestep"
import {increment_step} from "./systems/increment_step"
import * as Timestep from "./time_step"

export type Config = Timestep.Config

export let steps = (world: World.T) => world.get_resource(Timestep.res).steps()

let default_config: Config = {
  period: 1 / 60,
  max_update_delta_t: 0.25,
  max_drift_t: 1,
  overshoot: true,
}

export let advance = range(after(Time.advance))
export let control = range(after(Time.advance), before(advance))
export let logical = range(when(advance), when(steps))

export let plugin = (app: App, config?: Partial<Config>) => {
  let stepper_config = {...default_config, ...config}
  let stepper = Timestepper.make(stepper_config)
  let timestep = Timestep.make(stepper)
  app
    .add_resource(Timestep.res, timestep)
    .add_system(advance_timestep, when(advance), before(logical))
    .add_system(increment_step, when(advance), when(steps), after(logical))
}

export * from "./time_step"
