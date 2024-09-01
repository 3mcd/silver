import {expect, test} from "vitest"
import * as Stepper from "./timestepper"

type CartesianProduct<T> = {
  [K in keyof T]: T[K] extends (infer _)[] ? _ : never
}[]

let cartesianProduct = <T extends unknown[][]>(
  ...arr: T
): CartesianProduct<T> => {
  return arr.reduce((arr, b) =>
    arr.flatMap(d => b.map(e => [d, e].flat())),
  ) as CartesianProduct<T>
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

test("LastUndershoot exact", () => {
  let steps = test_termination(false)
  expect(steps).toBe(1)
})

test("LastUndershoot below", () => {
  let steps = test_termination(false, 0.5)
  expect(steps).toBe(0)
})

test("LastUndershoot above", () => {
  let steps = test_termination(false, 1.5)
  expect(steps).toBe(1)
})

test("FirstOvershoot exact", () => {
  let steps = test_termination(true)
  expect(steps).toBe(1)
})

test("FirstOvershoot below", () => {
  let steps = test_termination(true, 0.5)
  expect(steps).toBe(1)
})

test("FirstOvershoot above", () => {
  let steps = test_termination(true, 1.5)
  expect(steps).toBe(2)
})

let interestingTimes = [
  PERIOD,
  -PERIOD,
  PERIOD * 2,
  -PERIOD * 2,
  PERIOD * 100,
  -PERIOD * 100,
]

let interestingFramesPerUpdate = [1, 1.7, 0.5, 2.5, 2]
let defaultConfig = {
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
  let deltaTime = PERIOD * frames
  let targetTime = time + deltaTime - drift

  return [targetTime, timestep.advance(deltaTime, targetTime)]
}

test("ignores drift when timestep drifts within the frame", () => {
  let drifts = [
    0,
    PERIOD * 0.001,
    -PERIOD * 0.001,
    PERIOD * 0.499,
    -PERIOD * 0.499,
  ]
  for (let [drift, time, frames] of cartesianProduct(
    drifts,
    interestingTimes,
    interestingFramesPerUpdate,
  )) {
    let timestep = Stepper.make(defaultConfig)
    timestep.reset(time)
    expect(timestep.measure_drift(time)).toBeCloseTo(0)
    expect(timestep.measure_drift(time - drift)).toBeCloseTo(drift)

    let [targetTime, steps] = update(timestep, frames, time, drift)
    expect(timestep.measure_drift(targetTime)).toBeCloseTo(drift)
    expect(steps).toEqual(Math.ceil(frames))
  }
})

test("corrects timestamp when timestep drifts beyond a frame", () => {
  let drifts = [PERIOD * 0.5, -PERIOD * 0.5]
  for (let [drift, time, frames] of cartesianProduct(
    drifts,
    interestingTimes,
    interestingFramesPerUpdate,
  )) {
    let timestep = Stepper.make(defaultConfig)
    timestep.reset(time)
    expect(timestep.measure_drift(time)).toBeCloseTo(0)
    expect(timestep.measure_drift(time - drift)).toBeCloseTo(drift)

    let [targetTime, steps] = update(timestep, frames, time, drift)
    expect(timestep.measure_drift(targetTime)).toBeCloseTo(0)
    expect(steps).toEqual(Math.round((timestep.t() - time) / PERIOD))
  }
})

test("skips timestamps when drift is beyond threshold", () => {
  let maxDrift = 1
  let maxUpdateDelta = 0.25
  let maxSkipDelta = maxDrift + maxUpdateDelta
  let drifts = [
    maxSkipDelta,
    -maxSkipDelta,
    maxSkipDelta * 2,
    -maxSkipDelta * 2,
  ]
  for (let [drift, time, frames] of cartesianProduct(
    drifts,
    interestingTimes,
    interestingFramesPerUpdate,
  )) {
    let expectedStepCount =
      drift >= 0 ? 0 : Math.ceil(maxUpdateDelta / PERIOD) + 1
    let timestep = Stepper.make({
      period: PERIOD,
      max_update_delta_t: maxUpdateDelta,
      max_drift_t: maxDrift,
      overshoot: true,
    })
    timestep.reset(time)
    expect(timestep.measure_drift(time)).toBeCloseTo(0)

    let [targetTime, steps] = update(timestep, frames, time, drift)
    expect(timestep.measure_drift(targetTime)).toBeCloseTo(0)
    expect(steps).toBe(expectedStepCount)
  }
})

test("should not drift while delta is changing", () => {
  for (let time of interestingTimes) {
    let timestep = Stepper.make(defaultConfig)
    timestep.reset(time)
    expect(timestep.measure_drift(time)).toBeCloseTo(0)
    for (let frames of interestingFramesPerUpdate) {
      let delta = PERIOD * frames
      time += delta
      timestep.advance(delta, time)
      expect(timestep.measure_drift(time)).toBeCloseTo(0)
    }
  }
})
