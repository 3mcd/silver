import {Mock, expect, it, vi} from "vitest"
import {make as app} from "../../app/index.ts"
import * as System from "../../app/system.ts"
import * as Time from "../time/plugin.ts"
import * as Timestep from "./plugin.ts"
import {increment_step} from "./systems/increment_step.ts"

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
  let sys_before: System.Fn = world => {
    steps_before = world.get_resource(Timestep.res).steps()
  }
  let sys_after: System.Fn = world => {
    steps_after = world.get_resource(Timestep.res).steps()
  }
  app()
    .use(Time.plugin)
    .use(Timestep.plugin, config)
    .add_system(sys_before, System.before(Timestep.advance))
    .add_system(sys_after, System.after(Timestep.advance))
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
    .add_system(system, System.when(Timestep.logical))
  let t = 0
  test_advance_time(game, (t += PERIOD), system, 1)
  test_advance_time(game, (t += PERIOD), system, 1)
  test_advance_time(game, (t += PERIOD / 2), system, 0)
  test_advance_time(game, (t += PERIOD / 2 + Number.EPSILON), system, 1)
})

it("uses performance.now System.when time resource not set", () => {
  vi.useFakeTimers()
  let system = vi.fn()
  let game = app()
    .use(Time.plugin)
    .use(Timestep.plugin, config)
    .add_system(system, System.when(Timestep.logical))
  test_advance_timers(game, PERIOD_MS, system, 1)
  test_advance_timers(game, PERIOD_MS, system, 1)
  test_advance_timers(game, PERIOD_MS / 2, system, 0)
  test_advance_timers(game, PERIOD_MS / 2, system, 1)
  vi.useRealTimers()
})

it("increments the step counter after Timestep.logical", () => {
  let steps_before: number[] = []
  let steps_after: number[] = []
  let sys_before: System.Fn = world => {
    steps_before.push(world.get_resource(Timestep.res).step())
  }
  let sys_after: System.Fn = world => {
    steps_after.push(world.get_resource(Timestep.res).step())
  }
  app()
    .use(Time.plugin)
    .use(Timestep.plugin, config)
    .add_system(sys_before, System.when(Timestep.logical))
    .add_system(
      sys_after,
      System.when(Timestep.steps),
      System.after(increment_step),
    )
    .set_resource(Time.time, PERIOD * 5 - Number.EPSILON)
    .run()
  expect(steps_before).toEqual([0, 1, 2, 3])
  expect(steps_after).toEqual([1, 2, 3, 4])
})
