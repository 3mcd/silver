import {expect, it, vi} from "vitest"
import * as World from "../../../world"
import * as Timestep from "../timestep"
import {increment_step} from "./increment_step"

let timestep = {
  increment_step: vi.fn(),
}

let world = {
  get_resource: vi.fn(res => {
    switch (res) {
      case Timestep.res:
        return timestep
    }
  }),
}

it("calls Timestep.increment_step", () => {
  increment_step(world as unknown as World.T)
  expect(timestep.increment_step).toHaveBeenCalledOnce()
})
