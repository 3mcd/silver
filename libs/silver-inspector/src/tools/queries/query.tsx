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
import {Box, HStack} from "../../../styled-system/jsx"
import {Kbd} from "../../components/kbd"

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
        <HStack>
          <Box paddingX={4}>
            <Kbd>Ctrl + Click</Kbd> to select
          </Box>
          <IconButton
            aria-label="Select all"
            title="Select all"
            variant="ghost"
            onClick={onSelectAll}
          >
            <ListChecks />
          </IconButton>
        </HStack>
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
