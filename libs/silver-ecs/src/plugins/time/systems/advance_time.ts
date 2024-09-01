import {System} from "../../../app/index"
import * as Clock from "../time"

export let advance_time: System = world => {
  let clock = world.get_resource(Clock.res)
  clock.advance()
}
