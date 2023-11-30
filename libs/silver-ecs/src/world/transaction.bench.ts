import {perf} from "../../../silver-bench/dist"
import * as Entity from "../entity/entity"
import * as Graph from "./graph"
import * as Transition from "./transaction"
import * as Type from "../data/type"
import * as Component from "../data/component"

let [A, B, C, D, E, F, G, H, I, J, K] = Array.from({length: 11}, Component.tag)

let fixture = () => {
  let transition = Transition.make()
  return {transition}
}

perf("relocate 1000 entities", () => {
  let {transition} = fixture()
  let count = 1_000
  let graph = Graph.make()
  let nodeA = Graph.resolve(graph, A)
  let nodeB = Graph.resolve(graph, B)
  return () => {
    for (let i = 0; i < count; i++) {
      Transition.move(transition, i as Entity.T, nodeA, nodeB)
    }
  }
})

perf("relocate 1000 times", () => {
  let {transition} = fixture()
  let count = 1_000
  let graph = Graph.make()
  let nodeA = Graph.resolve(graph, A)
  let nodeB = Graph.resolve(graph, B)
  let nodeC = Graph.resolve(graph, C)
  let entity = 0 as Entity.T
  Transition.move(transition, entity, nodeA, nodeB)
  return () => {
    for (let i = 0; i < count; i++) {
      Transition.move(transition, entity, nodeB, nodeC)
    }
  }
})

perf("drain 1000 entities", () => {
  let {transition} = fixture()
  let count = 1_000
  let graph = Graph.make()
  let types = [
    A,
    Type.make(A, B, C),
    Type.make(D, E),
    Type.make(E, F, G, H, I, J),
    K,
    Type.make(A, B, C, D, E, F, G, H, I, J, K),
    Type.make(A, B),
  ]
  for (let i = 0; i < types.length; i++) {
    Graph.resolve(graph, types[i])
  }
  for (let i = 0; i < count; i++) {
    Transition.move(
      transition,
      i as Entity.T,
      Graph.resolve(graph, types[i % types.length]),
      Graph.resolve(graph, types[(i + 1) % types.length]),
    )
  }
  return () => {
    Transition.drain(transition, graph, "")
  }
})
