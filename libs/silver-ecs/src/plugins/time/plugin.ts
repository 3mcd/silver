import {after, Plugin, range, when} from "../../app"
import {advance_time} from "./systems/advance_time"
import * as Time from "./time"

export let advance = range()

export let plugin: Plugin = app => {
  let time = Time.make()
  app.add_resource(Time.res, time).add_system(advance_time, when(advance))
}

export * from "./time"
