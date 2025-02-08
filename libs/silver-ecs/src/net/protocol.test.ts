import * as Component from "#component"
import * as Entity from "#entity"
import {f32} from "#schema"
import {mock_world} from "#test/mock_world"
import {expect, test} from "vitest"
import * as Interest from "./interest"
import * as Protocol from "./protocol"
import * as Serde from "./serde"
import * as Buffer from "#buffer"

let A = Component.ref<number>(f32)
let B = Component.ref<number>(f32)
let C = Component.ref<number>(f32)

test("interest message", () => {
  let world = mock_world()
  world.set_resource(Serde.res, Serde.make().add(A).add(C))
  let buffer = Protocol.init_interest()
  let interest = Interest.Interest.init()
  let entity = Entity.make(0, 0)
  world.set(entity, A, 12)
  world.set(entity, B, 13)
  world.set(entity, C, 14)
  interest.amplify(entity, 1)
  Protocol.encode_interest(buffer, interest, world.build())
  console.log(Buffer.end(buffer))
  expect(true).toBe(true)
})
