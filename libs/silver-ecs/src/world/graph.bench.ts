import {perf} from "../../../silver-bench/dist"
import * as Graph from "./graph"
import * as Component from "../data/component"
import * as Type from "../data/type"

let [A, B, C, D, E, F, G, H, I, J, K] = Array.from({length: 11}, Component.tag)

let fixture = () => {
  let graph = Graph.make()
  Graph.resolve_node_by_type(graph, Type.make(B, C, D, E, J))
  Graph.resolve_node_by_type(graph, Type.make(F, G, H, I, J))
  Graph.resolve_node_by_type(graph, Type.make(A, B, H, I, J))
  Graph.resolve_node_by_type(graph, Type.make(A, K))
  Graph.resolve_node_by_type(graph, Type.make(B, H))
  Graph.resolve_node_by_type(graph, Type.make(I, J))
  Graph.resolve_node_by_type(graph, Type.make(D, E, J))
  return {graph}
}

perf("insert isolate", () => {
  let {graph} = fixture()
  return () => {
    Graph.resolve_node_by_type(graph, K)
  }
})

perf("insert simple", () => {
  let {graph} = fixture()
  return () => {
    Graph.resolve_node_by_type(graph, J)
  }
})

perf("insert complex", () => {
  let {graph} = fixture()
  let type = Type.make(A, B, C, D, E, F, G, H, I, J)
  return () => {
    Graph.resolve_node_by_type(graph, type)
  }
})
