import {System} from "../../../app"
import * as Clock from "../../time"
import * as Timestep from "../timestep"

export let advance_timestep: System = world => {
  let timestep = world.get_resource(Timestep.res)
  let clock = world.get_resource(Clock.res)
  let t = timestep.is_controlled() ? timestep.t_control() : clock.t_monotonic()
  let t_delta = t > timestep.period() ? clock.delta() : clock.t_monotonic()
  timestep.advance(t_delta, t)
}
