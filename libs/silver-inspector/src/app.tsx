import {ListX, Trash2, X} from "lucide-react"
import {Query, World} from "silver-ecs"
import {HStack, Stack} from "../styled-system/jsx"
import {IconButton} from "./components/icon_button"
import {Tabs} from "./components/tabs"
import {Aliases} from "./context/alias_context"
import {AliasProvider} from "./context/alias_provider"
import {QueryProvider} from "./context/query_provider"
import {SelectedProvider} from "./context/selected_provider"
import {WorldProvider} from "./context/world_provider"
import {useSelections} from "./hooks/use_selections"
import "./index.css"
import {Entities} from "./tools/entities"
import {Graph} from "./tools/graph"
import {Queries} from "./tools/queries"

export type AppProps = {
  world: World
  aliases?: Aliases
  queries?: {
    [key: string]: Query
  }
  onClose?(): void
}

type InspectorProps = {
  onClose?(): void
}

let Inspector = (props: InspectorProps) => {
  let selections = useSelections()
  return (
    <Stack height="100%" minWidth="500px">
      <Tabs.Root
        defaultValue="world"
        width="100%"
        height="100%"
        variant="outline"
      >
        <HStack gap={0} alignItems="flex-end">
          <Tabs.List flex="1">
            <Tabs.Trigger key="world" value="world">
              World
            </Tabs.Trigger>
            <Tabs.Trigger key="queries" value="queries">
              Queries
            </Tabs.Trigger>
            <Tabs.Trigger key="graph" value="graph">
              Graph
            </Tabs.Trigger>
            <Tabs.Indicator />
          </Tabs.List>
          <IconButton
            variant="ghost"
            onClick={selections.clear}
            aria-label="Clear selection"
            disabled={selections.selected.length === 0}
          >
            <ListX />
          </IconButton>
          <IconButton
            variant="ghost"
            onClick={selections.despawn}
            aria-label="Despawn selection"
            disabled={selections.selected.length === 0}
          >
            <Trash2 />
          </IconButton>
          <IconButton variant="ghost" onClick={props.onClose}>
            <X />
          </IconButton>
        </HStack>
        <Tabs.Content value="world" height="100%" overflow="hidden">
          <Entities />
        </Tabs.Content>
        <Tabs.Content value="queries" height="100%" overflow="hidden">
          <Queries />
        </Tabs.Content>
        <Tabs.Content value="graph" height="100%" overflow="hidden">
          <Graph />
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  )
}

export default function App(props: AppProps) {
  return (
    <WorldProvider world={props.world}>
      <AliasProvider aliases={props.aliases}>
        <SelectedProvider>
          <QueryProvider queries={props.queries}>
            <Inspector onClose={props.onClose} />
          </QueryProvider>
        </SelectedProvider>
      </AliasProvider>
    </WorldProvider>
  )
}
