import {mock_world} from "../../../test/mock_world.ts"
import {expect, it, vi} from "vitest"
import * as Time from "../time.ts"
import {advance_time} from "./advance_time.ts"

let time = {
  advance: vi.fn(),
}

let world = mock_world().set_resource(Time.res, time).build()

it("advances time using performance.now", () => {
  let t_mono = 0.5
  let t_mono_ms = t_mono * 1000
  vi.useFakeTimers()
  vi.advanceTimersByTime(t_mono_ms)
  world.set_resource(Time.time, undefined)
  advance_time(world)
  expect(time.advance).toHaveBeenCalledWith(t_mono)
  vi.useRealTimers()
})

it("advances time using Time.time when set", () => {
  world.set_resource(Time.time, 0.1)
  advance_time(world)
  expect(time.advance).toHaveBeenCalledWith(0.1)
})
