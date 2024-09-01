import {expect, it, vi} from "vitest"
import {mock_world} from "../../../../mocks/mock_world"
import * as Timestep from "../timestep"
import {increment_step} from "./increment_step"

let timestep = {
  increment_step: vi.fn(),
}

let world = mock_world().set_resource(Timestep.res, timestep).to_world()

it("calls Timestep.increment_step", () => {
  increment_step(world)
  expect(timestep.increment_step).toHaveBeenCalledOnce()
})
