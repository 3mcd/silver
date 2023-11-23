import * as ecs from "silver-ecs"
import {QueryDef} from "../../context/query_context"
import {useQuery} from "../../hooks/use_queries"
import {EntityList} from "../../components/entity_list"
import {IconButton} from "../../components/icon_button"
import {ListChecks} from "lucide-react"
import {Page} from "../../components/page"
import {TypeHeader} from "../../components/type_header"
import {useCallback} from "react"
import {DebugSelected} from "silver-lib"
import {useWorld} from "../../hooks/use_world"

type Props = {
  query: QueryDef
  onBack(): void
  onEntitySelected(entity: ecs.Entity, ctrlKey: boolean): void
  onEntityHoverIn(entity: ecs.Entity): void
  onEntityHoverOut(entity: ecs.Entity): void
}

export let Query = (props: Props) => {
  let world = useWorld()
  let results = useQuery(props.query.query)
  let onSelectAll = useCallback(() => {
    props.query.query.each(entity => {
      world.add(entity, DebugSelected)
    })
  }, [props.query, world])
  return (
    <Page
      title={props.query.name}
      extra={
        <IconButton
          onClick={onSelectAll}
          aria-label="Select all"
          variant="ghost"
        >
          <ListChecks />
        </IconButton>
      }
      onBack={props.onBack}
    >
      <TypeHeader
        type={props.query.query.type}
        onEntitySelected={props.onEntitySelected}
      />
      <EntityList
        entities={results}
        type={props.query.query.type}
        onEntitySelected={props.onEntitySelected}
        onEntityHoverIn={props.onEntityHoverIn}
        onEntityHoverOut={props.onEntityHoverOut}
      />
    </Page>
  )
}
