import {perf} from "silver-bench"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Changes from "../world/changes"
import * as Changed from "./changed"

const A = Component.tag()
const B = Component.tag()
const C = Component.tag()

const type = Type.make(A, B, C)
const entities = Array.from({length: 1000}, (_, i) => Entity.make(i, 0))

perf("compare 1000 entities with 3 components", () => {
  const state = Changed.make_filter_state()
  const changes = Changes.make()
  const changed = Changed.compile_predicate(type, changes, state)
  return () => {
    for (let i = 0; i < entities.length; i++) {
      changed(entities[i])
    }
  }
})
