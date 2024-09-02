import {expect, it} from "vitest"
import * as Stepper from "./stepper"

type Product<T> = {
  [K in keyof T]: T[K] extends (infer _)[] ? _ : never
}[]

let product = <T extends unknown[][]>(...arr: T) => {
  return arr.reduce((arr, b) =>
    arr.flatMap(d => b.map(e => [d, e].flat())),
  ) as Product<T>
}

let PERIOD = 1 / 60

function test_termination(overshoot: boolean, frames = 1) {
  let timestep = Stepper.make({
    period: PERIOD,
    max_update_delta_t: 0.25,
    max_drift_t: 1 / 60,
    overshoot,
  })
  return timestep.advance(PERIOD * frames, PERIOD * frames)
}

it("exact", () => {
  let steps = test_termination(false)
  expect(steps).toBe(1)
})

it("below", () => {
  let steps = test_termination(false, 0.5)
  expect(steps).toBe(0)
})

it("above", () => {
  let steps = test_termination(false, 1.5)
  expect(steps).toBe(1)
})

it("overshoot exact", () => {
  let steps = test_termination(true)
  expect(steps).toBe(1)
})

it("overshoot below", () => {
  let steps = test_termination(true, 0.5)
  expect(steps).toBe(1)
})

it("overshoot above", () => {
  let steps = test_termination(true, 1.5)
  expect(steps).toBe(2)
})

let times = [
  PERIOD,
  -PERIOD,
  PERIOD * 2,
  -PERIOD * 2,
  PERIOD * 100,
  -PERIOD * 100,
]

let frames_per_update = [1, 1.7, 0.5, 2.5, 2]
let default_config = {
  period: PERIOD,
  max_update_delta_t: 0.25,
  max_drift_t: 1,
  overshoot: true,
}

let update = (
  timestep: Stepper.T,
  frames: number,
  time: number,
  drift: number,
) => {
  let t_delta = PERIOD * frames
  let t_target = time + t_delta - drift

  return [t_target, timestep.advance(t_delta, t_target)]
}

it("ignores drift when timestep drifts within the frame", () => {
  let drifts = [
    0,
    PERIOD * 0.001,
    -PERIOD * 0.001,
    PERIOD * 0.499,
    -PERIOD * 0.499,
  ]
  for (let [drift, time, frames] of product(drifts, times, frames_per_update)) {
    let timestep = Stepper.make(default_config)
    timestep.reset(time)
    expect(timestep.measure_drift(time)).toBeCloseTo(0)
    expect(timestep.measure_drift(time - drift)).toBeCloseTo(drift)

    let [t_target, steps] = update(timestep, frames, time, drift)
    expect(timestep.measure_drift(t_target)).toBeCloseTo(drift)
    expect(steps).toEqual(Math.ceil(frames))
  }
})

it("corrects timestamp when timestep drifts beyond a frame", () => {
  let drifts = [PERIOD * 0.5, -PERIOD * 0.5]
  for (let [drift, time, frames] of product(drifts, times, frames_per_update)) {
    let timestep = Stepper.make(default_config)
    timestep.reset(time)
    expect(timestep.measure_drift(time)).toBeCloseTo(0)
    expect(timestep.measure_drift(time - drift)).toBeCloseTo(drift)

    let [t_target, steps] = update(timestep, frames, time, drift)
    expect(timestep.measure_drift(t_target)).toBeCloseTo(0)
    expect(steps).toEqual(Math.round((timestep.t() - time) / PERIOD))
  }
})

it("skips timestamps when drift is beyond threshold", () => {
  let max_drift_t = 1
  let max_update_delta_t = 0.25
  let max_skip_delta_t = max_drift_t + max_update_delta_t
  let drifts = [
    max_skip_delta_t,
    -max_skip_delta_t,
    max_skip_delta_t * 2,
    -max_skip_delta_t * 2,
  ]
  for (let [drift, time, frames] of product(drifts, times, frames_per_update)) {
    let steps_expected =
      drift >= 0 ? 0 : Math.ceil(max_update_delta_t / PERIOD) + 1
    let stepper = Stepper.make({
      period: PERIOD,
      max_update_delta_t,
      max_drift_t,
      overshoot: true,
    })
    stepper.reset(time)
    expect(stepper.measure_drift(time)).toBeCloseTo(0)

    let [t_target, steps] = update(stepper, frames, time, drift)
    expect(stepper.measure_drift(t_target)).toBeCloseTo(0)
    expect(steps).toBe(steps_expected)
  }
})

it("should not drift while delta is changing", () => {
  for (let time of times) {
    let stepper = Stepper.make(default_config)
    stepper.reset(time)
    expect(stepper.measure_drift(time)).toBeCloseTo(0)
    for (let frames of frames_per_update) {
      let delta = PERIOD * frames
      time += delta
      stepper.advance(delta, time)
      expect(stepper.measure_drift(time)).toBeCloseTo(0)
    }
  }
})

it("resets to the next increment of config.period when overshoot=true", () => {
  let stepper = Stepper.make({...default_config, overshoot: true})
  stepper.reset(default_config.period * 0.5)
  expect(stepper.t()).toBe(default_config.period)
})

it("resets to the previous increment of config.period when overshoot=false", () => {
  let stepper = Stepper.make({...default_config, overshoot: false})
  stepper.reset(default_config.period * 0.5)
  expect(stepper.t()).toBe(0)
})
