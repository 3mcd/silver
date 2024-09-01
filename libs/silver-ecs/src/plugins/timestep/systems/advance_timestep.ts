import {System} from "../../../app"
import * as Time from "../../time"
import * as Timestep from "../timestep"

export let advance_timestep: System = world => {
  let timestep = world.get_resource(Timestep.res)
  let time = world.get_resource(Time.res)
  timestep.advance(
    time.delta(),
    timestep.is_controlled() ? timestep.t_control() : time.t_monotonic(),
  )
}
