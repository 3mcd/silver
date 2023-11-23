import {useCallback, useState} from "react"
import * as ecs from "silver-ecs"
import {Assert, DebugHighlighted, DebugSelected} from "silver-lib"
import {useWorld} from "../../hooks/use_world"
import {Entity} from "../../components/entity"
import {EntityNode} from "./entity_node"
import {EntityNodes} from "./entity_nodes"

type State =
  | {mode: "nodes"}
  | {mode: "node"; node: ecs.Graph.Node}
  | {mode: "entity"; node: ecs.Graph.Node; entity: ecs.Entity}

export let Entities = () => {
  const [state, setState] = useState<State>({mode: "nodes"})
  let world = useWorld()
  let onBack = useCallback(() => {
    switch (state.mode) {
      case "node":
        return setState({mode: "nodes"})
      case "entity":
        return setState({mode: "node", node: state.node})
    }
  }, [state])
  let onNodeSelected = useCallback((node: ecs.Graph.Node) => {
    setState({mode: "node", node})
  }, [])
  let onEntitySelected = useCallback(
    (entity: ecs.Entity, select: boolean) => {
      Assert.ok(state.mode !== "nodes")
      setState({mode: "entity", entity, node: state.node})
    },
    [state],
  )
  let onEntityHoverIn = useCallback((entity: ecs.Entity) => {}, [world])
  let onEntityHoverOut = useCallback((entity: ecs.Entity) => {}, [world])
  switch (state.mode) {
    case "nodes":
      return <EntityNodes onNodeSelected={onNodeSelected} />
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
