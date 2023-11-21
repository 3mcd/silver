import {
  Entity,
  Graph,
  SparseSet
} from "silver-ecs"
import { useNode } from "../../hooks/use_graph"
import { EntityList } from "../../pages/entity_list"

type Props = {
  node: Graph.Node
  onEntitySelected: (entity: Entity, select: boolean) => void
  onEntityHoverIn: (entity: Entity) => void
  onEntityHoverOut: (entity: Entity) => void
  onBack(): void
}

export let EntityNode = (props: Props) => {
  useNode(props.node)
  return (
    <EntityList
      entities={SparseSet.values(props.node.entities)}
      type={props.node.type}
      onEntitySelected={props.onEntitySelected}
      onEntityHoverIn={props.onEntityHoverIn}
      onEntityHoverOut={props.onEntityHoverOut}
      onBack={props.onBack}
    />
  )
}
