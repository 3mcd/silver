import {expect, it} from "vitest"
import {after, app, before, System} from "../../app"
import * as Time from "./plugin"

it("advances time during Time.advance", () => {
  let t_before: number | undefined
  let t_after: number | undefined
  let sys_before: System = world => {
    let time = world.get_resource(Time.res)
    t_before = time.t_mono()
  }
  let sys_after: System = world => {
    let time = world.get_resource(Time.res)
    t_after = time.t_mono()
  }
  app()
    .use(Time.plugin)
    .add_system(sys_before, before(Time.advance))
    .add_system(sys_after, after(Time.advance))
    .set_resource(Time.time, 1)
    .run()
  expect(t_before).toBe(0)
  expect(t_after).toBe(1)
})
