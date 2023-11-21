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
  let on_back = useCallback(() => {
    switch (state.status) {
      case "node":
        return setState({status: "nodes"})
      case "entity":
        return setState({status: "node", node: state.node})
    }
  }, [state])
  let on_node_selected = useCallback((node: ecs.Graph.Node) => {
    setState({status: "node", node})
  }, [])
  let on_entity_selected = useCallback(
    (entity: ecs.Entity, select: boolean) => {
      if (select) {
        if (world.has(entity, DebugSelected)) {
          world.remove(entity, DebugSelected)
        } else {
          world.add(entity, DebugSelected)
        }
      } else {
        if (state.status === "node") {
          setState({status: "entity", entity, node: state.node})
        }
      }
    },
    [state],
  )
  let on_entity_hover_in = useCallback((entity: ecs.Entity) => {
    if (!world.has(entity, DebugHighlighted)) {
      world.add(entity, DebugHighlighted)
    }
  }, [])
  let on_entity_hover_out = useCallback((entity: ecs.Entity) => {
    if (world.has(entity, DebugHighlighted)) {
      world.remove(entity, DebugHighlighted)
    }
  }, [])
  switch (state.status) {
    case "nodes":
      return <EntityNodes onNodeSelected={on_node_selected} />
    case "node":
      return (
        <EntityNode
          node={state.node}
          onEntitySelected={on_entity_selected}
          onEntityHoverIn={on_entity_hover_in}
          onEntityHoverOut={on_entity_hover_out}
          onBack={on_back}
        />
      )
    case "entity":
      return (
        <Entity entity={state.entity} type={state.node.type} onBack={on_back} />
      )
  }
}
