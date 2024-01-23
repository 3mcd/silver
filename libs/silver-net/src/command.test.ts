import {suite, test, expect} from "vitest"
import * as Model from "./model"
import * as S from "silver-ecs"
import {decodeSpawn, encodeSpawn} from "./command"

suite("command", () => {
  test("spawn", () => {
    let A = S.tag()
    let B = S.tag()
    let model = Model.make(A, B)
    let message = new ArrayBuffer(1024)
    let view = new DataView(message)
    let offset = 0
    let type = S.type(A, B)
    encodeSpawn(view, offset, model, {
      kind: "spawn",
      entity: 0 as S.Entity,
      type,
      init: [],
    })
    let t = decodeSpawn(view, 0, model)
    expect(t.hash).toBe(type.hash)
  })
})
