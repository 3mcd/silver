import {List, ListX, Trash, Trash2, X} from "lucide-react"
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
import {Text} from "./components/text"
import {Menu} from "./components/menu"

export type AppProps = {
  world: World
  aliases?: Aliases
  queries?: {
    [key: string]: Query
  }
  onClose?(): void
}

type Props = {
  onClose?(): void
}

let Inspector = (props: Props) => {
  let selections = useSelections()
  return (
    <Stack
      height="100%"
      minWidth="500px"
      backgroundColor="bg.default"
      backdropFilter="blur(12px)"
    >
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
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                position="relative"
                variant="ghost"
                disabled={selections.selected.length === 0}
              >
                <List />
                {selections.selected.length > 0 && (
                  <Text
                    as="span"
                    position="absolute"
                    right="0"
                    bottom="0"
                    transform="translate(-4px, -3px)"
                    padding="0 2px"
                    backgroundColor="sky.7"
                    borderRadius="3"
                    lineHeight="15px"
                    height="15px"
                    fontSize="xx-small"
                  >
                    {selections.selected.length}
                  </Text>
                )}
              </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content backgroundColor="bg.solid">
                <Menu.ItemGroup id="group-1">
                  <Menu.Item id="clear" onClick={selections.clear}>
                    <HStack gap="2">
                      <ListX /> Clear selection
                    </HStack>
                  </Menu.Item>
                  <Menu.Item id="despawn" onClick={selections.despawn}>
                    <HStack gap="2">
                      <Trash /> Despawn selected
                    </HStack>
                  </Menu.Item>
                </Menu.ItemGroup>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
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
