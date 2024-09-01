import {after, range, Plugin} from "../../app/index"
import * as Time from "./time"
import {advance_time} from "./systems/advance_time"

export let plugin: Plugin = app => {
  let time = Time.make()
  app
    .add_resource(Time.res, time)
    .add_init_system(advance_time)
    .add_system(advance_time)
}

export let read = range(after(advance_time))

export * from "./time"
