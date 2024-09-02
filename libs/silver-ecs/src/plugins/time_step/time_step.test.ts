import {it, expect} from "vitest"
import * as Timestep from "./time_step"
import * as Timestepper from "./stepper"

let default_config = {
  period: 1 / 60,
  max_update_delta_t: 0.25,
  max_drift_t: 1,
  overshoot: false,
}

it("increments step", () => {
  let timestepper = Timestepper.make(default_config)
  let timestep = Timestep.make(timestepper)
  expect(timestep.step()).toEqual(0)
  timestep.increment_step()
  expect(timestep.step()).toEqual(1)
})

it("controls timestep", () => {
  let timestepper = Timestepper.make(default_config)
  let timestep = Timestep.make(timestepper)
  expect(timestep.is_controlled()).toEqual(false)
  timestep.control(1)
  expect(timestep.is_controlled()).toEqual(true)
  expect(timestep.is_controlled() && timestep.t_control()).toEqual(1)
})

it("returns the configured period of its timestepper", () => {
  let timestepper = Timestepper.make(default_config)
  let timestep = Timestep.make(timestepper)
  expect(timestep.period()).toEqual(default_config.period)
})
