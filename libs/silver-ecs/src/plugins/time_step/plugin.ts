import {after, App, before, when} from "#app/index"
import * as Range from "#app/range"
import * as Time from "#plugins/time/plugin"
import * as World from "#world"
import * as Timestepper from "./stepper.ts"
import {advance_timestep} from "./systems/advance_timestep.ts"
import {increment_step} from "./systems/increment_step.ts"
import * as Timestep from "./time_step.ts"

export type Config = Timestep.Config

export let steps = (world: World.t) => world.get_resource(Timestep.res).steps()

let default_config: Config = {
  period: 1 / 60,
  max_update_delta_t: 0.25,
  max_drift_t: 1,
  overshoot: true,
}

export let advance = Range.make(after(Time.advance))
export let control = Range.make(after(Time.advance), before(advance))
export let logical = Range.make(when(advance), when(steps))

export let plugin = (app: App, config?: Partial<Config>) => {
  let stepper_config = {...default_config, ...config}
  let stepper = Timestepper.make(stepper_config)
  let timestep = Timestep.make(stepper)
  app
    .add_resource(Timestep.res, timestep)
    .add_system(advance_timestep, when(advance), before(logical))
    .add_system(increment_step, when(advance), when(steps), after(logical))
}

export * from "./time_step.ts"
