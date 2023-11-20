import {useCallback, useState} from "react"
import * as ecs from "silver-ecs"
import {DebugSelected} from "silver-lib"
import {useWorld} from "../../hooks/use_world"
import {Entity} from "./entity"
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
    (entity: ecs.Entity, node: ecs.Graph.Node, select: boolean) => {
      if (select) {
        if (world.has(entity, DebugSelected)) {
          world.remove(entity, DebugSelected)
        } else {
          world.add(entity, DebugSelected)
        }
      } else {
        setState({status: "entity", entity, node})
      }
    },
    [],
  )
  switch (state.status) {
    case "nodes":
      return <EntityNodes onNodeSelected={on_node_selected} />
    case "node":
      return (
        <EntityNode
          node={state.node}
          onEntitySelected={on_entity_selected}
          onBack={on_back}
        />
      )
    case "entity":
      return <Entity entity={state.entity} node={state.node} onBack={on_back} />
  }
}
