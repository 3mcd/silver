import {expect, it, vi} from "vitest"
import {mock_world} from "../../../test/mock_world.ts"
import * as Time from "../../time/plugin.ts"
import * as Timestep from "../time_step.ts"
import {advance_timestep} from "./advance_timestep.ts"

let time = {
  t_delta: vi.fn().mockReturnValue(1 / 60),
  t_mono: vi.fn().mockReturnValue(1),
}

let timestep = {
  advance: vi.fn(),
  is_controlled: vi.fn(() => false),
  t_control: vi.fn().mockReturnValue(1.1),
}

let world = mock_world()
  .set_resource(Time.res, time)
  .set_resource(Timestep.res, timestep)
  .build()

it("advances using Timestep.t_control when controlled", () => {
  timestep.is_controlled.mockReturnValueOnce(true)
  advance_timestep(world)
  expect(timestep.advance).toHaveBeenCalledWith(
    time.t_delta(),
    timestep.t_control(),
  )
})

it("advances using Time.t_mono when not controlled", () => {
  advance_timestep(world)
  expect(timestep.advance).toHaveBeenCalledWith(time.t_delta(), time.t_mono())
})
