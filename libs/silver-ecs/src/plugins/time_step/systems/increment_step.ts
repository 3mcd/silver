import {System} from "../../../app/index.ts"
import * as Timestep from "../time_step.ts"

export let increment_step: System = world => {
  world.get_resource(Timestep.res).increment()
}
