import {perf} from "silver-bench"
import * as Component from "./component"
import * as Type from "./type"

let components = Array.from({length: 20}, Component.valueRelation)

perf("create a type with 20 components", () => {
  return () => {
    Type.make.apply(null, components)
  }
})

perf("calculate the xor of 2 types with 6 components each", () => {
  let type_a = Type.make.apply(null, components.slice(0, 6))
  let type_b = Type.make.apply(null, components.slice(4, 10))
  return () => {
    Type.xor(type_a, type_b)
  }
})

perf("hydrate relationships of a type with 20 components", () => {
  let type = Type.make.apply(null, components)
  let init = components.map(() => [0, 0])
  return () => {
    Type.with_relationships(type, init)
  }
})
