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
    <Stack height="100%" minWidth="500px" backgroundColor="bg.default">
      <Tabs.Root
        defaultValue="world"
        width="100%"
        height="100%"
        variant="outline"
      >
        <HStack gap={0} alignItems="flex-end">
          <Tabs.List flex="1" marginBottom="0">
            <Tabs.Trigger key="world" value="world" border="none">
              World
            </Tabs.Trigger>
            <Tabs.Trigger key="queries" value="queries" border="none">
              Queries
            </Tabs.Trigger>
            <Tabs.Trigger key="graph" value="graph" border="none">
              Graph
            </Tabs.Trigger>
            <Tabs.Indicator />
          </Tabs.List>
          <IconButton
            aria-label="Clear entity selection"
            title="Clear entity selection"
            variant="ghost"
            disabled={selections.selected.length === 0}
            onClick={selections.clear}
          >
            <ListX />
          </IconButton>
          <IconButton
            aria-label="Despawn selected entities"
            title="Despawn selected entities"
            variant="ghost"
            disabled={selections.selected.length === 0}
            onClick={selections.despawn}
          >
            <Trash2 />
          </IconButton>
          <IconButton
            aria-label="Close"
            title="Close"
            variant="ghost"
            onClick={props.onClose}
          >
            <X />
          </IconButton>
        </HStack>
        <Tabs.Content
          value="world"
          height="100%"
          overflow="hidden"
          paddingX="0 !important"
          border="none"
        >
          <Entities />
        </Tabs.Content>
        <Tabs.Content
          value="queries"
          height="100%"
          overflow="hidden"
          paddingX="0 !important"
          border="none"
        >
          <Queries />
        </Tabs.Content>
        <Tabs.Content
          value="graph"
          height="100%"
          overflow="hidden"
          paddingX="0 !important"
          border="none"
        >
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
