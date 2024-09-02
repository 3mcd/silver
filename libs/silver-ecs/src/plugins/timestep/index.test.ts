import {it, expect, vi, Mock} from "vitest"
import {after, app, when, System, before} from "../../app"
import * as Time from "../time"
import * as Timestep from "./index"
import {increment_step} from "./systems"

let PERIOD = 1 / 60
let PERIOD_MS = PERIOD * 1000
let config = {
  period: PERIOD,
  overshoot: false,
}

let test_advance_time = (
  game: ReturnType<typeof app>,
  t: number,
  fn: Mock,
  steps: number,
) => {
  game.set_resource(Time.time, t).run()
  expect(fn).toHaveBeenCalledTimes(steps)
  fn.mockClear()
}

let test_advance_timers = (
  game: ReturnType<typeof app>,
  t_delta: number,
  fn: Mock,
  steps: number,
) => {
  // vitest/sinon truncates mocked timer times to 8 decimal places
  vi.advanceTimersByTime(parseFloat(t_delta.toPrecision(8)))
  game.run()
  expect(fn).toHaveBeenCalledTimes(steps)
  fn.mockClear()
}

it("throws an error when Time is not installed", () => {
  expect(() => app().use(Timestep.plugin).run()).toThrow()
})

it("computes step count before Timestep.logical", () => {
  let steps_before: number | undefined
  let steps_after: number | undefined
  let sys_before: System = world => {
    steps_before = world.get_resource(Timestep.res).steps()
  }
  let sys_after: System = world => {
    steps_after = world.get_resource(Timestep.res).steps()
  }
  app()
    .use(Time.plugin)
    .use(Timestep.plugin, config)
    .add_system(sys_before, before(Timestep.update))
    .add_system(sys_after, after(Timestep.update))
    .set_resource(Time.time, PERIOD * 2)
    .run()
  expect(steps_before).toBe(0)
  expect(steps_after).toBe(2)
})

it("steps at a fixed interval", () => {
  let system = vi.fn()
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, config)
    .add_system(system, when(Timestep.fixed))
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
    .use(Timestep.plugin, config)
    .add_system(system, when(Timestep.fixed))
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
    steps_before.push(world.get_resource(Timestep.res).step())
  }
  let sys_after: System = world => {
    steps_after.push(world.get_resource(Timestep.res).step())
  }
  app()
    .use(Time.plugin)
    .use(Timestep.plugin, config)
    .add_system(sys_before, when(Timestep.fixed))
    .add_system(sys_after, when(Timestep.steps), after(increment_step))
    .set_resource(Time.time, PERIOD * 5 - Number.EPSILON)
    .run()
  expect(steps_before).toEqual([0, 1, 2, 3])
  expect(steps_after).toEqual([1, 2, 3, 4])
})
