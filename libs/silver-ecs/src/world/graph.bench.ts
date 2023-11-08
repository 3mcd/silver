import {perf} from "../../../silver-bench/dist"
import * as Graph from "./graph"
import * as Component from "../data/component"
import * as Type from "../data/type"

let [A, B, C, D, E, F, G, H, I, J, K] = Array.from({length: 11}, Component.tag)

let fixture = () => {
  let graph = Graph.make()
  Graph.resolve(graph, Type.make(B, C, D, E, J))
  Graph.resolve(graph, Type.make(F, G, H, I, J))
  Graph.resolve(graph, Type.make(A, B, H, I, J))
  Graph.resolve(graph, Type.make(A, K))
  Graph.resolve(graph, Type.make(B, H))
  Graph.resolve(graph, Type.make(I, J))
  Graph.resolve(graph, Type.make(D, E, J))
  return {graph}
}

perf("insert isolate", () => {
  let {graph} = fixture()
  return () => {
    Graph.resolve(graph, K)
  }
})

perf("insert simple", () => {
  let {graph} = fixture()
  return () => {
    Graph.resolve(graph, J)
  }
})

perf("insert complex", () => {
  let {graph} = fixture()
  let type = Type.make(A, B, C, D, E, F, G, H, I, J)
  return () => {
    Graph.resolve(graph, type)
  }
})
