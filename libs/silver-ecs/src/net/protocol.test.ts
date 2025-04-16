import * as Component from "#component"
import * as Entity from "#entity"
import {f32} from "#schema"
import {mock_world} from "#test/mock_world"
import {expect, test} from "vitest"
import * as Interest from "./interest.ts"
import * as Protocol from "./protocol.ts"
import * as Serde from "./serde.ts"

let A = Component.ref(f32)
let B = Component.ref(f32)
let C = Component.ref({foo: f32})

test("interest message", () => {
  let serde = Serde.make().add(A).add(C)
  let source = mock_world().set_resource(Serde.res, serde).build()
  let buffer = Protocol.init_interest()
  let interest = Interest.Interest.init()
  let entity = Entity.make(0, 0)
  source.set(entity, A, 12)
  source.set(entity, B, 13)
  source.set(entity, C, {foo: 14})
  interest.amplify(entity, 1)
  Protocol.encode_interest(buffer, interest, source)
  let target = mock_world().set_resource(Serde.res, serde).build()
  // skip the message type
  buffer.read_u8()
  Protocol.decode_interest(buffer, target, true)
  expect(target.get(entity, A)).toBe(source.get(entity, A))
  expect(target.get(entity, B)).toBe(undefined)
  expect(target.get(entity, C)).toEqual(source.get(entity, C))
})
