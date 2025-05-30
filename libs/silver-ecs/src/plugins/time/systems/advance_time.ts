import {System} from "#app/index"
import * as Time from "../time.ts"

export let advance_time: System = world => {
  let time = world.get_resource(Time.res)
  let t_mono = world.get_resource_opt(Time.time) ?? performance.now() / 1_000
  time.advance(t_mono)
}
