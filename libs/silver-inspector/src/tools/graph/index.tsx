import {useCallback, useEffect, useState} from "react"
import * as S from "silver-ecs"
import {Assert} from "silver-lib"
import {useWorld} from "../../hooks/use_world"
import {Entity} from "../entities/entity"
import {EntityNode} from "../entities/entity_node"
import {GraphVis} from "./graph_vis"

type State =
  | {mode: "graph"}
  | {mode: "node"; node: S.Graph.Node}
  | {mode: "entity"; node: S.Graph.Node; entity: S.Entity}

export let Graph = () => {
  const [state, setState] = useState<State>({mode: "graph"})
  let world = useWorld()
  let onBack = useCallback(() => {
    switch (state.mode) {
      case "node":
        return setState({mode: "graph"})
      case "entity":
        return setState({mode: "node", node: state.node})
    }
  }, [state])
  let onNodeSelected = useCallback((node: S.Graph.Node) => {
    setState({mode: "node", node})
  }, [])
  let onEntitySelected = useCallback(
    (entity: S.Entity, select: boolean) => {
      Assert.ok(state.mode !== "graph")
      setState({mode: "entity", entity, node: state.node})
    },
    [state],
  )
  let onEntityHoverIn = useCallback((entity: S.Entity) => {}, [world])
  let onEntityHoverOut = useCallback((entity: S.Entity) => {}, [world])
  switch (state.mode) {
    case "graph":
      return <GraphVis onNodeSelected={onNodeSelected} />
    case "node":
      return (
        <EntityNode
          node={state.node}
          onEntitySelected={onEntitySelected}
          onEntityHoverIn={onEntityHoverIn}
          onEntityHoverOut={onEntityHoverOut}
          onBack={onBack}
        />
      )
    case "entity":
      return (
        <Entity
          entity={state.entity}
          onBack={onBack}
          onEntitySelected={onEntitySelected}
        />
      )
  }
}
