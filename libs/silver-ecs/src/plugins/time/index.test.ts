import {it, expect} from "vitest"
import {app, before, System, when} from "../../app"
import * as Time from "./index"

it("advances time before Time.read", () => {
  let t_before: number | undefined
  let t_when: number | undefined
  let sys_before: System = world => {
    let time = world.get_resource(Time.res)
    t_before = time.t_mono()
  }
  let sys_when: System = world => {
    let time = world.get_resource(Time.res)
    t_when = time.t_mono()
  }
  app()
    .use(Time.plugin)
    .add_system(sys_before, before(Time.read))
    .add_system(sys_when, when(Time.read))
    .set_resource(Time.time, 1)
    .run()
  expect(t_before).toBe(0)
  expect(t_when).toBe(1)
})
