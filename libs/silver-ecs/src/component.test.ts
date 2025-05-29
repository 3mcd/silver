import {expect, it} from "vitest"
import * as Component from "./component.ts"
import * as Entity from "./entity.ts"

it("encodes the relation id and entity", () => {
  let rel = Component.rel()
  let pair = rel(1 as Entity.t)
  expect(Component.parse_pair_rel_id(pair)).toBe(rel().id)
  expect(Component.parse_pair_entity(pair)).toBe(1)
})
