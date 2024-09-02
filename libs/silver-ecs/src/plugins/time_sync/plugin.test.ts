import {expect, it} from "vitest"
import {System, app, when} from "../../app"
import * as Time from "../time/plugin"
import * as Timestep from "../time_step/plugin"
import * as Timesync from "./plugin"

it("controls the timestep using an estimated server time offset", () => {
  let add_sample_system: System = world => {
    let time = world.get_resource(Time.res)
    let time_sync = world.get_resource(Timesync.res)
    let t_client = time.t_mono() + 1
    let t_server = t_client + 1
    time_sync.add_sample([t_client, t_server], time.t_mono())
  }
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin)
    .use(Timesync.plugin)
    .add_system(add_sample_system, when(Timesync.collect))
  let time_sync = game.world().get_resource(Timesync.res)
  let time_step = game.world().get_resource(Timestep.res)
  let t = 0
  while (true) {
    game.set_resource(Time.time, t).run()
    if (time_sync.is_synced()) {
      expect(time_step.is_controlled() && time_step.t_control()).toBe(
        time_sync.estimate_t_remote(t),
      )
      break
    }
    expect(time_step.is_controlled()).toBe(false)
    t++
  }
})
