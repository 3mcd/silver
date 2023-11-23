import {useCallback, useEffect, useState} from "react"
import {Query, World} from "silver-ecs"
import {HStack, Stack, styled} from "../styled-system/jsx"
import {Tabs} from "./components/tabs"
import {Aliases} from "./context/alias_context"
import {AliasProvider} from "./context/alias_provider"
import {QueryProvider} from "./context/query_provider"
import {WorldProvider} from "./context/world_provider"
import "./index.css"
import {Entities} from "./tools/entities"
import {Queries} from "./tools/queries"
import {Graph} from "./tools/graph"
import {IconButton} from "./components/icon_button"
import {SearchX, X} from "lucide-react"
import {SelectedProvider} from "./context/selected_provider"
import {useSelections} from "./hooks/use_selections"

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
      <Tabs.Root defaultValue="world" width="100%" height="100%">
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
          {selections.selected.length > 0 && (
            <IconButton
              variant="ghost"
              size="lg"
              boxShadow="0 -1px 0 0 inset token(colors.border.default)"
              onClick={selections.clear}
              aria-label="Clear selection"
            >
              <SearchX />
            </IconButton>
          )}
          <IconButton
            variant="ghost"
            size="lg"
            boxShadow="0 -1px 0 0 inset token(colors.border.default)"
            onClick={props.onClose}
          >
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
