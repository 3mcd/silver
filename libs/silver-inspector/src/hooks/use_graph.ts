import {useContext, useEffect, useState} from "react"
import {Graph, Signal, SparseMap} from "silver-ecs"
import {worldContext} from "../context/world_context"

let compareNodes = (a: Graph.Node, b: Graph.Node) => {
  return a.type.componentIds.length - b.type.componentIds.length
}

export let useGraph = () => {
  let world = useContext(worldContext)
  let [nodes, setNodes] = useState(() =>
    SparseMap.values(world.graph.nodesById).slice().sort(compareNodes),
  )
  useEffect(() => {
    let unsubscribeCreated = Signal.subscribe(world.graph.root.$created, () => {
      setNodes(
        SparseMap.values(world.graph.nodesById).slice().sort(compareNodes),
      )
    })
    let unsubscribeRemoved = Signal.subscribe(world.graph.root.$removed, () => {
      setNodes(
        SparseMap.values(world.graph.nodesById).slice().sort(compareNodes),
      )
    })
    return () => {
      unsubscribeCreated()
      unsubscribeRemoved()
    }
  }, [])

  return {nodes}
}

export let useNode = (node: Graph.Node) => {
  let [version, setVersion] = useState(0)
  useEffect(
    () => Signal.subscribe(node.$changed, () => setVersion(v => v + 1)),
    [node],
  )
  return node.isDropped ? -1 : version
}
