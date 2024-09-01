import {after, Plugin, range} from "../../app/index"
import * as systems from "./systems"
import * as Time from "./time"

export let plugin: Plugin = app => {
  let time = Time.make()
  app.add_resource(Time.res, time).add_system(systems.advance_time)
}

export let read = range(after(systems.advance_time))

export * from "./time"
