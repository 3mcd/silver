import {test, expect} from "vitest"
import * as Query from "./query.ts"
import * as Selector from "./selector.ts"
import * as Entity from "./entity.ts"
import {mock_world} from "#test/mock_world"
import {Component} from "#index"

type ResultsOf<T> = T extends Query.t<infer U> ? U[] : never

let A = Component.ref()
let B = Component.tag()
let C = Component.tag()

test("entity selector", () => {
  let world = mock_world()
  let query_selector = Selector.make().with("entity").with(A).with(B)
  let query = Query.make(query_selector, world.build())
  let query_results: ResultsOf<typeof query> = []
  let entity_a = 0 as Entity.t
  let entity_b = 1 as Entity.t
  let query_results_map = new Map<Entity.t, string>([
    [entity_a, "test"],
    [entity_b, "test2"],
  ])
  world.add(entity_a, A, query_results_map.get(entity_a)).add(entity_a, B)
  world
    .add(entity_b, A, query_results_map.get(entity_b))
    .add(entity_b, B)
    .add(entity_b, C)
  query.for_each((...query_result) => {
    query_results.push(query_result)
  })
  expect(query_results).toEqual(query_results_map.entries().toArray())
})
