import {System} from "../../../app"
import * as Time from "../../time"
import * as Timestep from "../timestep"

export let advance_timestep: System = world => {
  let timestep = world.get_resource(Timestep.res)
  let time = world.get_resource(Time.res)
  let t = timestep.is_controlled() ? timestep.t_control() : time.t_monotonic()
  let t_delta = t > timestep.period() ? time.delta() : time.t_monotonic()
  timestep.advance(t_delta, t)
}
