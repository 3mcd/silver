import {suite, test, expect} from "vitest"
import * as QueryBuilder from "./query_builder"
import * as Query from "./query_2"
import * as Component from "./component"
import * as Graph from "./graph"
import * as Type from "./type"
import * as Entity from "./entity"

suite("query_builder", () => {
  test("make", () => {
    let RefA = Component.ref<"A">()
    let RefB = Component.ref<"B">()
    let RelA = Component.rel()
    let RelB = Component.rel()
    let graph = Graph.make()
    let query_builder = QueryBuilder.make()
      .with(RelA, q => q.with(RefA))
      .with(RelB, q => q.with(RefB))
      .with(RefA)
  })
})
