import {expect, it, vi} from "vitest"
import {advance_timestep} from "./advance_timestep"
import * as Time from "../../time"
import * as Timestep from "../timestep"
import * as World from "../../../world"

let T_DELTA = 1 / 60
let T_CONTROL = 1.1
let T_MONOTONIC = 1

let time = {
  delta: vi.fn().mockReturnValue(T_DELTA),
  t_monotonic: vi.fn().mockReturnValue(T_MONOTONIC),
}

let timestep = {
  advance: vi.fn(),
  is_controlled: vi.fn(),
  t_control: vi.fn().mockReturnValue(T_CONTROL),
}

let world = {
  get_resource: vi.fn(res => {
    switch (res) {
      case Time.res:
        return time
      case Timestep.res:
        return timestep
    }
  }),
}

it("advances using t_control when controlled", () => {
  timestep.is_controlled.mockReturnValueOnce(true)
  advance_timestep(world as unknown as World.T)
  expect(timestep.advance).toHaveBeenCalledWith(T_DELTA, T_CONTROL)
  timestep.advance.mockClear()
})

it("advances using the monotonic time when not controlled", () => {
  timestep.is_controlled.mockReturnValueOnce(false)
  advance_timestep(world as unknown as World.T)
  expect(timestep.advance).toHaveBeenCalledWith(T_DELTA, T_MONOTONIC)
  timestep.advance.mockClear()
})
