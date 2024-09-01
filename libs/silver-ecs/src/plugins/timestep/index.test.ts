import {it, expect, vi, Mock} from "vitest"
import {after, app, when} from "../../app"
import * as Time from "../time"
import * as Timestep from "./index"
import {increment_step} from "./systems"

let PERIOD = 1 / 60
let PERIOD_MS = PERIOD * 1000

let test_advance_time = (
  game: ReturnType<typeof app>,
  t: number,
  mock: Mock,
  steps: number,
) => {
  game.set_resource(Time.time, t).run()
  expect(mock).toHaveBeenCalledTimes(steps)
  mock.mockClear()
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
  let mock = vi.fn()
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, {
      period: PERIOD,
      overshoot: false,
    })
    .add_system(mock, when(Timestep.logical))
  let t = 0
  test_advance_time(game, (t += PERIOD), mock, 1)
  test_advance_time(game, (t += PERIOD), mock, 1)
  test_advance_time(game, (t += PERIOD / 2), mock, 0)
  test_advance_time(game, (t += PERIOD / 2 + Number.EPSILON), mock, 1)
})

it("uses performance.now when time resource not set", () => {
  vi.useFakeTimers()
  let mock = vi.fn()
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, {
      period: PERIOD,
      overshoot: false,
    })
    .add_system(mock, when(Timestep.logical))
  test_advance_timers(game, PERIOD_MS, mock, 1)
  test_advance_timers(game, PERIOD_MS, mock, 1)
  test_advance_timers(game, PERIOD_MS / 2, mock, 0)
  test_advance_timers(game, PERIOD_MS / 2, mock, 1)
  vi.useRealTimers()
})

it("increments the step counter after Timestep.logical", () => {
  let steps_before: number[] = []
  let steps_after: number[] = []
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, {
      period: PERIOD,
      overshoot: false,
    })
    .add_system(world => {
      steps_before.push(world.get_resource(Timestep.res).step())
    }, when(Timestep.logical))
    .add_system(
      world => {
        steps_after.push(world.get_resource(Timestep.res).step())
      },
      when(Timestep.steps),
      after(increment_step),
    )
  game.set_resource(Time.time, PERIOD * 5 - Number.EPSILON).run()
  expect(steps_before).toEqual([0, 1, 2, 3])
  expect(steps_after).toEqual([1, 2, 3, 4])
})
