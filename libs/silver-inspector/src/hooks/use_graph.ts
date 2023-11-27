import {useContext, useEffect, useState} from "react"
import * as S from "silver-ecs"
import {worldContext} from "../context/world_context"

let compareNodes = (a: S.Graph.Node, b: S.Graph.Node) => {
  return a.type.ids.length - b.type.ids.length
}

export let useGraph = () => {
  let world = useContext(worldContext)
  let [nodes, setNodes] = useState(() =>
    S.SparseMap.values(world.graph.nodesById).slice().sort(compareNodes),
  )
  useEffect(() => {
    let unsubscribeCreated = S.Signal.subscribe(
      world.graph.root.$created,
      () => {
        setNodes(
          S.SparseMap.values(world.graph.nodesById).slice().sort(compareNodes),
        )
      },
    )
    let unsubscribeRemoved = S.Signal.subscribe(
      world.graph.root.$removed,
      () => {
        setNodes(
          S.SparseMap.values(world.graph.nodesById).slice().sort(compareNodes),
        )
      },
    )
    return () => {
      unsubscribeCreated()
      unsubscribeRemoved()
    }
  }, [])

  return {nodes}
}

export let useNode = (node: S.Graph.Node) => {
  let [version, setVersion] = useState(0)
  useEffect(
    () => S.Signal.subscribe(node.$changed, () => setVersion(v => v + 1)),
    [node],
  )
  return node.isDropped ? -1 : version
}
