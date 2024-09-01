import {expect, it, vi} from "vitest"
import {mock_world} from "../../../test"
import * as Time from "../time"
import {advance_time} from "./advance_time"

let time = {
  advance: vi.fn(),
}

let world = mock_world().set_resource(Time.res, time).build()

it("advances time using performance.now", () => {
  let t = 0.5
  let t_ms = t * 1000
  vi.useFakeTimers()
  vi.advanceTimersByTime(t_ms)
  world.set_resource(Time.time, undefined)
  advance_time(world)
  expect(time.advance).toHaveBeenCalledWith(t)
  vi.useRealTimers()
})

it("advances time using Time.time when set", () => {
  world.set_resource(Time.time, 0.1)
  advance_time(world)
  expect(time.advance).toHaveBeenCalledWith(0.1)
})
