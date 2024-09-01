import {System} from "../../../app/index"
import * as Time from "../time"

export let advance_time: System = world => {
  let time = world.get_resource(Time.res)
  time.advance()
}
