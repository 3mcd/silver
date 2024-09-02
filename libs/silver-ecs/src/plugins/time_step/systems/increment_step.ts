import {System} from "../../../app"
import * as Timestep from "../time_step"

export let increment_step: System = world => {
  world.get_resource(Timestep.res).increment_step()
}
