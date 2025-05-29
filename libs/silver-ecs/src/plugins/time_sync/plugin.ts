import {App, Criteria} from "#app/index"
import * as System from "#app/system"
import * as Range from "#app/range"
import * as Time from "../time/plugin.ts"
import * as Timestep from "../time_step/plugin.ts"
import {control_timestep} from "./systems/control_timestep.ts"
import * as Timesync from "./time_sync.ts"
import {info} from "#logger"

export type Config = Timesync.Config

let default_config: Config = {
  max_offset: 0.1,
  min_offset_samples: 8,
  outlier_rate: 0.1,
}

export let control = Range.make(System.when(Timestep.control))
export let collect = Range.make(
  System.after(Time.advance),
  System.before(control),
)

export let synced: Criteria = world =>
  world.get_resource(Timesync.res).is_synced()

export let plugin = (app: App, config?: Partial<Config>) => {
  let time_sync_config = {...default_config, ...config}
  let time_sync = Timesync.make(time_sync_config)
  info("time_sync", {event: "use", config: time_sync_config})
  app
    .add_resource(Timesync.res, time_sync)
    .add_system(control_timestep, System.when(control), System.when(synced))
}

export * from "./time_sync.ts"
