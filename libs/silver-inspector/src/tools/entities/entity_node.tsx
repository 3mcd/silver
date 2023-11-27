import * as S from "silver-ecs"
import {EntityList} from "../../components/entity_list"
import {Page} from "../../components/page"
import {TypeHeader} from "../../components/type_header"
import {useNode} from "../../hooks/use_graph"
import {Text} from "../../components/text"

type Props = {
  node: S.Graph.Node
  onEntitySelected: (entity: S.Entity, select: boolean) => void
  onEntityHoverIn: (entity: S.Entity) => void
  onEntityHoverOut: (entity: S.Entity) => void
  onBack(): void
}

export let EntityNode = (props: Props) => {
  let version = useNode(props.node)
  return (
    <Page title={`Node ${props.node.id}`} onBack={props.onBack}>
      {version === -1 ? (
        <Text padding="4">This node was deleted.</Text>
      ) : (
        <>
          <TypeHeader
            type={props.node.type}
            onEntitySelected={props.onEntitySelected}
          />
          <EntityList
            entities={S.SparseSet.values(props.node.entities)}
            type={props.node.type}
            onEntitySelected={props.onEntitySelected}
            onEntityHoverIn={props.onEntityHoverIn}
            onEntityHoverOut={props.onEntityHoverOut}
          />
        </>
      )}
    </Page>
  )
}
