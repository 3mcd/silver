import {after, App, before, Criteria, range, when} from "../../app"
import * as Time from "../time/plugin"
import * as Timestep from "../time_step/plugin"
import {control_timestep} from "./systems/control_timestep"
import * as Timesync from "./time_sync"

export type Config = Timesync.Config

let default_config: Config = {
  max_offset: 0.1,
  min_offset_samples: 8,
  outlier_rate: 0.1,
}

export let control = range(when(Timestep.control))
export let collect = range(after(Time.advance), before(control))

export let synced: Criteria = world =>
  world.get_resource(Timesync.res).is_synced()

export let plugin = (app: App, config?: Partial<Config>) => {
  let time_sync = Timesync.make({...default_config, ...config})
  app
    .add_resource(Timesync.res, time_sync)
    .add_system(control_timestep, when(control), when(synced))
}

export * from "./time_sync"
