import {expect, it, vi} from "vitest"
import {mock_world} from "../../../test"
import * as Timestep from "../timestep"
import {increment_step} from "./increment_step"

let timestep = {
  increment_step: vi.fn(),
}

let world = mock_world().set_resource(Timestep.res, timestep).build()

it("calls Timestep.increment_step", () => {
  increment_step(world)
  expect(timestep.increment_step).toHaveBeenCalledOnce()
})
