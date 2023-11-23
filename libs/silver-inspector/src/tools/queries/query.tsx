import * as ecs from "silver-ecs"
import {QueryDef} from "../../context/query_context"
import {useQuery} from "../../hooks/use_queries"
import {EntityList} from "../../pages/entity_list"

type Props = {
  query: QueryDef
  onBack(): void
  onEntitySelected(entity: ecs.Entity, ctrlKey: boolean): void
  onEntityHoverIn(entity: ecs.Entity): void
  onEntityHoverOut(entity: ecs.Entity): void
}

export let Query = (props: Props) => {
  let results = useQuery(props.query.query)
  return (
    <EntityList
      title={props.query.name}
      entities={results}
      type={props.query.query.type}
      onEntitySelected={props.onEntitySelected}
      onEntityHoverIn={props.onEntityHoverIn}
      onEntityHoverOut={props.onEntityHoverOut}
      onBack={props.onBack}
    />
  )
}
