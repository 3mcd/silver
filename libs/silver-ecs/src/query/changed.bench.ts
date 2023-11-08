import {perf} from "silver-bench"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Changes from "../world/changes"
import * as Changed from "./changed"

let A = Component.tag()
let B = Component.tag()
let C = Component.tag()

let type = Type.make(A, B, C)
let entities = Array.from({length: 1000}, (_, i) => Entity.make(i, 0))

perf("compare 1000 entities with 3 components", () => {
  let state = Changed.make_filter_state()
  let changes = Changes.make()
  let changed = Changed.compile_predicate(type, changes, state)
  return () => {
    for (let i = 0; i < entities.length; i++) {
      changed(entities[i])
    }
  }
})
