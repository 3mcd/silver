import {System} from "../../../app/index.ts"
import * as Time from "../../time/plugin.ts"
import * as Timestep from "../time_step.ts"

export let advance_timestep: System = world => {
  let timestep = world.get_resource(Timestep.res)
  let time = world.get_resource(Time.res)
  timestep.advance(
    time.t_delta(),
    timestep.is_controlled() ? timestep.t_control() : time.t_mono(),
  )
}
