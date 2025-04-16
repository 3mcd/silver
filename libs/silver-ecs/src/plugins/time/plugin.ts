import {Plugin, when} from "#app/index"
import * as Range from "#app/range"
import {advance_time} from "./systems/advance_time.ts"
import * as Time from "./time.ts"

export let advance = Range.make()

export let plugin: Plugin = app => {
  let time = Time.make()
  app.add_resource(Time.res, time).add_system(advance_time, when(advance))
}

export * from "./time.ts"
