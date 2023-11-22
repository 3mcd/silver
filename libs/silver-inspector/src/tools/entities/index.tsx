import {useCallback, useState} from "react"
import * as ecs from "silver-ecs"
import {DebugHighlighted, DebugSelected} from "silver-lib"
import {useWorld} from "../../hooks/use_world"
import {Entity} from "../../pages/entity"
import {EntityNode} from "./entity_node"
import {EntityNodes} from "./entity_nodes"

type Props = {}

type State =
  | {
      status: "nodes"
    }
  | {
      status: "node"
      node: ecs.Graph.Node
    }
  | {
      status: "entity"
      entity: ecs.Entity
      node: ecs.Graph.Node
    }

export let Entities = (props: Props) => {
  let world = useWorld()
  let [state, setState] = useState<State>({
    status: "nodes",
  })
  let onBack = useCallback(() => {
    switch (state.status) {
      case "node":
        return setState({status: "nodes"})
      case "entity":
        return setState({status: "node", node: state.node})
    }
  }, [state])
  let onNodeSelected = useCallback((node: ecs.Graph.Node) => {
    setState({status: "node", node})
  }, [])
  let onEntitySelected = useCallback(
    (entity: ecs.Entity, select: boolean) => {
      if (select) {
        if (world.has(entity, DebugSelected)) {
          world.remove(entity, DebugSelected)
        } else {
          world.add(entity, DebugSelected)
        }
      } else {
        if (world.has(entity, DebugHighlighted)) {
          world.remove(entity, DebugHighlighted)
        }
        if (state.status === "node") {
          setState({status: "entity", entity, node: state.node})
        }
      }
    },
    [state],
  )
  let onEntityHoverIn = useCallback((entity: ecs.Entity) => {}, [])
  let onEntityHoverOut = useCallback((entity: ecs.Entity) => {}, [])
  switch (state.status) {
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
