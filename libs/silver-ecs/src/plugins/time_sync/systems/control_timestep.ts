import {System} from "#app/index"
import * as Time from "#plugins/time/plugin"
import * as Timestep from "#plugins/time_step/plugin"
import * as Timesync from "../time_sync"

export let control_timestep: System = world => {
  let time = world.get_resource(Time.res)
  let time_step = world.get_resource(Timestep.res)
  let time_sync = world.get_resource(Timesync.res)
  let t_current = time_sync.estimate_t_remote(time.t_mono())
  time_step.control(t_current)
}
