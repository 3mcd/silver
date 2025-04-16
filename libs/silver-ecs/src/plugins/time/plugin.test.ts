import {expect, it, vi} from "vitest"
import {make as app} from "../../app/index.ts"
import * as System from "#app/system"
import * as Time from "./plugin.ts"

it("advances time during Time.advance", () => {
  let t_mono_a: number | undefined
  let t_mono_b: number | undefined
  let sys_before: System.Fn = world => {
    let time = world.get_resource(Time.res)
    t_mono_a = time.t_mono()
  }
  let sys_after: System.Fn = world => {
    let time = world.get_resource(Time.res)
    t_mono_b = time.t_mono()
  }
  app()
    .use(Time.plugin)
    .add_system(sys_before, System.before(Time.advance))
    .add_system(sys_after, System.after(Time.advance))
    .set_resource(Time.time, 1)
    .run()
  expect(t_mono_a).toBe(0)
  expect(t_mono_b).toBe(1)
})

it("uses performance.now() if Time.time is not set", () => {
  let t = 2
  let t_ms = t * 1_000
  vi.useFakeTimers()
  vi.advanceTimersByTime(t_ms)
  let t_mono_a: number | undefined
  let t_mono_b: number | undefined
  let sys_before: System.Fn = world => {
    let time = world.get_resource(Time.res)
    t_mono_a = time.t_mono()
  }
  let sys_after: System.Fn = world => {
    let time = world.get_resource(Time.res)
    t_mono_b = time.t_mono()
  }
  app()
    .use(Time.plugin)
    .add_system(sys_before, System.before(Time.advance))
    .add_system(sys_after, System.after(Time.advance))
    .run()
  expect(t_mono_a).toBe(0)
  expect(t_mono_b).toBe(t)
  vi.useRealTimers()
})
