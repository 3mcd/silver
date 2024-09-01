import {it, expect, vi, Mock} from "vitest"
import {after, app, when, System} from "../../app"
import * as Time from "../time"
import * as Timestep from "./index"
import {increment_step} from "./systems"

let PERIOD = 1 / 60
let PERIOD_MS = PERIOD * 1000

let test_advance_time = (
  game: ReturnType<typeof app>,
  t: number,
  system: Mock,
  steps: number,
) => {
  game.set_resource(Time.time, t).run()
  expect(system).toHaveBeenCalledTimes(steps)
  system.mockClear()
}

let test_advance_timers = (
  game: ReturnType<typeof app>,
  t_delta: number,
  mock: Mock,
  steps: number,
) => {
  // vitest/sinon truncates mocked timer times to 8 decimal places
  vi.advanceTimersByTime(parseFloat(t_delta.toPrecision(8)))
  game.run()
  expect(mock).toHaveBeenCalledTimes(steps)
  mock.mockClear()
}

it("throws an error when Time is not installed", () => {
  let game = app().use(Timestep.plugin)
  expect(() => game.run()).toThrow()
})

it.todo("advances the timestep after Time.read")

it("steps at a fixed interval", () => {
  let system = vi.fn()
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, {
      period: PERIOD,
      overshoot: false,
    })
    .add_system(system, when(Timestep.logical))
  let t = 0
  test_advance_time(game, (t += PERIOD), system, 1)
  test_advance_time(game, (t += PERIOD), system, 1)
  test_advance_time(game, (t += PERIOD / 2), system, 0)
  test_advance_time(game, (t += PERIOD / 2 + Number.EPSILON), system, 1)
})

it("uses performance.now when time resource not set", () => {
  vi.useFakeTimers()
  let system = vi.fn()
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, {
      period: PERIOD,
      overshoot: false,
    })
    .add_system(system, when(Timestep.logical))
  test_advance_timers(game, PERIOD_MS, system, 1)
  test_advance_timers(game, PERIOD_MS, system, 1)
  test_advance_timers(game, PERIOD_MS / 2, system, 0)
  test_advance_timers(game, PERIOD_MS / 2, system, 1)
  vi.useRealTimers()
})

it("increments the step counter after Timestep.logical", () => {
  let steps_before: number[] = []
  let steps_after: number[] = []
  let sys_before: System = world => {
    steps_before.push(Timestep.steps(world))
  }
  let sys_after: System = world => {
    steps_after.push(Timestep.steps(world))
  }
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, {
      period: PERIOD,
      overshoot: false,
    })
    .add_system(sys_before, when(Timestep.logical))
    .add_system(sys_after, when(Timestep.steps), after(increment_step))
  game.set_resource(Time.time, PERIOD * 5 - Number.EPSILON).run()
  expect(steps_before).toEqual([0, 1, 2, 3])
  expect(steps_after).toEqual([1, 2, 3, 4])
})
