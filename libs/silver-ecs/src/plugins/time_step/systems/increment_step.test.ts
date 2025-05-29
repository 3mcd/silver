import {expect, it, vi} from "vitest"
import {mock_world} from "../../../test/mock_world.ts"
import * as Timestep from "../time_step.ts"
import {increment_step} from "./increment_step.ts"

let timestep = {
  increment: vi.fn(),
}

let world = mock_world().set_resource(Timestep.res, timestep).build()

it("calls Timestep.increment_step", () => {
  increment_step(world)
  expect(timestep.increment).toHaveBeenCalledOnce()
})
