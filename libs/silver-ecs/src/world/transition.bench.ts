import {perf} from "../../../silver-bench/dist"
import * as Entity from "../entity/entity"
import * as Graph from "./graph"
import * as Transition from "./transition"
import * as Type from "../data/type"
import * as Component from "../data/component"

const [A, B, C, D, E, F, G, H, I, J, K] = Array.from(
  {length: 11},
  Component.tag,
)

const fixture = () => {
  const transition = Transition.make()
  return {transition}
}

perf("relocate 1000 entities", () => {
  const {transition} = fixture()
  const count = 1_000
  const graph = Graph.make()
  const node_a = Graph.resolve(graph, A)
  const node_b = Graph.resolve(graph, B)
  return () => {
    for (let i = 0; i < count; i++) {
      Transition.move(transition, i as Entity.T, node_a, node_b)
    }
  }
})

perf("relocate 1000 times", () => {
  const {transition} = fixture()
  const count = 1_000
  const graph = Graph.make()
  const node_a = Graph.resolve(graph, A)
  const node_b = Graph.resolve(graph, B)
  const node_c = Graph.resolve(graph, C)
  const entity = 0 as Entity.T
  Transition.move(transition, entity, node_a, node_b)
  return () => {
    for (let i = 0; i < count; i++) {
      Transition.move(transition, entity, node_b, node_c)
    }
  }
})

perf("drain 1000 entities", () => {
  const {transition} = fixture()
  const count = 1_000
  const graph = Graph.make()
  const types = [
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
