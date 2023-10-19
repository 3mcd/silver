import {perf} from "silver-bench"
import * as Component from "./component"
import * as Type from "./type"

const components = Array.from({length: 20}, Component.relation)

perf("create a type with 20 components", () => {
  return () => {
    Type.make.apply(null, components)
  }
})

perf("calculate the xor of 2 types", () => {
  const typeA = Type.make.apply(null, components.slice(0, 6))
  const typeB = Type.make.apply(null, components.slice(4, 10))
  return () => {
    Type.xor(typeA, typeB)
  }
})

perf("hydrate a type's relationships", () => {
  const type = Type.make.apply(null, components)
  const init = components.map(() => [0, 0])
  return () => {
    Type.withRelationships(type, init)
  }
})
