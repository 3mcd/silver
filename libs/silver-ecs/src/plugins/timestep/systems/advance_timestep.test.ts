import {expect, it, vi} from "vitest"
import {mock_world} from "../../../../mocks/mock_world"
import * as Time from "../../time"
import * as Timestep from "../timestep"
import {advance_timestep} from "./advance_timestep"

let T_DELTA = 1 / 60
let T_CONTROL = 1.1
let T_MONOTONIC = 1

let time = {
  delta: vi.fn().mockReturnValue(T_DELTA),
  t_monotonic: vi.fn().mockReturnValue(T_MONOTONIC),
}

let timestep = {
  advance: vi.fn(),
  is_controlled: vi.fn(() => false),
  t_control: vi.fn().mockReturnValue(T_CONTROL),
}

let world = mock_world()
  .set_resource(Time.res, time)
  .set_resource(Timestep.res, timestep)
  .build()

it("advances using t_control when controlled", () => {
  timestep.is_controlled.mockReturnValueOnce(true)
  advance_timestep(world)
  expect(timestep.advance).toHaveBeenCalledWith(T_DELTA, T_CONTROL)
})

it("advances using the monotonic time when not controlled", () => {
  advance_timestep(world)
  expect(timestep.advance).toHaveBeenCalledWith(T_DELTA, T_MONOTONIC)
})
