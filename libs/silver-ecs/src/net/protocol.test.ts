import * as Component from "#component"
import * as Entity from "#entity"
import {mock_world} from "#test/mock_world"
import {expect, test} from "vitest"
import * as Interest from "./interest.ts"
import * as Protocol from "./protocol.ts"
import * as Serde from "./serde.ts"

let A = Component.ref("f32")
let B = Component.ref("f32")
let C = Component.ref({foo: "f32"})

test("interest message", () => {
  let serde = Serde.make().add(A).add(C)
  let source_world = mock_world().set_resource(Serde.res, serde).build()
  let target_world = mock_world().set_resource(Serde.res, serde).build()
  let interest = Interest.Interest.init()
  let buffer = Protocol.init_interest()
  let entity = Entity.make(0, 0)
  source_world.set(entity, A, 12)
  source_world.set(entity, B, 13)
  source_world.set(entity, C, {foo: 14})
  interest.amplify(entity, 1)
  Protocol.encode_interest(buffer, interest, source_world)
  // skip the message type
  buffer.read_u8()
  Protocol.decode_interest(buffer, target_world)
  expect(target_world.get(entity, A)).toBe(source_world.get(entity, A))
  expect(target_world.get(entity, B)).toBe(undefined)
  expect(target_world.get(entity, C)).toEqual(source_world.get(entity, C))
})
