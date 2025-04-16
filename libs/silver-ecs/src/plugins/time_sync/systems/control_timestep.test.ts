import {expect, it, vi} from "vitest"
import {mock_world} from "../../../test/mock_world.ts"
import * as Time from "../../time/plugin.ts"
import * as Timestep from "../../time_step/plugin.ts"
import * as Timesync from "../time_sync.ts"
import {control_timestep} from "./control_timestep.ts"

let time = {
  t_mono: vi.fn().mockReturnValue(1),
}

let timestep = {
  control: vi.fn(),
}

let timesync = {
  estimate_t_remote: vi.fn((x: number) => x + 1),
}

let world = mock_world()
  .set_resource(Time.res, time)
  .set_resource(Timestep.res, timestep)
  .set_resource(Timesync.res, timesync)
  .build()

it("controls the timestep using the estimated remote time", () => {
  control_timestep(world)
  expect(timestep.control).toHaveBeenCalledWith(
    timesync.estimate_t_remote(time.t_mono()),
  )
})
