import {useContext, useLayoutEffect, useMemo, useState} from "react"
import {Graph, Signal, SparseMap, type} from "silver-ecs"
import {worldContext} from "../context/world_context"
import {useWorld} from "./use_world"
import {DebugSelected} from "silver-lib"

let compare_nodes = (a: Graph.Node, b: Graph.Node) => {
  return a.type.component_ids.length - b.type.component_ids.length
}

export let useGraph = () => {
  let world = useContext(worldContext)
  let [nodes, setNodes] = useState(() =>
    SparseMap.values(world.graph.nodes_by_id).slice().sort(compare_nodes),
  )

  useLayoutEffect(() => {
    let unsubscribe_created = Signal.subscribe(
      world.graph.root.$created,
      () => {
        setNodes(
          SparseMap.values(world.graph.nodes_by_id).slice().sort(compare_nodes),
        )
      },
    )
    let unsubscribe_removed = Signal.subscribe(
      world.graph.root.$removed,
      () => {
        setNodes(
          SparseMap.values(world.graph.nodes_by_id).slice().sort(compare_nodes),
        )
      },
    )
    return () => {
      unsubscribe_created()
      unsubscribe_removed()
    }
  }, [])

  return {nodes}
}

export let useNode = (node: Graph.Node) => {
  let [, setVersion] = useState(0)
  useLayoutEffect(() => {
    let unsubscribe_changed = Signal.subscribe(node.$changed, () => {
      setVersion(v => v + 1)
    })
    return () => {
      unsubscribe_changed()
    }
  }, [node])

  return node
}
