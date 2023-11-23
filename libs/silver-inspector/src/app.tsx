import {useEffect, useState} from "react"
import {Query, World} from "silver-ecs"
import {Stack} from "../styled-system/jsx"
import {Tabs} from "./components/tabs"
import {Aliases} from "./context/alias_context"
import {AliasProvider} from "./context/alias_provider"
import {QueryProvider} from "./context/query_provider"
import {WorldProvider} from "./context/world_provider"
import "./index.css"
import {Entities} from "./tools/entities"
import {Queries} from "./tools/queries"
import {Graph} from "./tools/graph"

export type AppProps = {
  world: World
  aliases?: Aliases
  queries?: {
    [key: string]: Query
  }
}

let Inspector = () => {
  return (
    <Stack height="100%">
      <Tabs.Root
        defaultValue="world"
        width="100%"
        height="100%"
        minWidth="20vw"
        paddingTop="2"
      >
        <Tabs.List>
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
  let [open, setOpen] = useState(false)
  useEffect(() => {
    let onKeydown = (e: KeyboardEvent) => {
      if (e.key === "`") {
        setOpen(open => !open)
      }
    }
    document.addEventListener("keydown", onKeydown)
    return () => document.removeEventListener("keydown", onKeydown)
  })
  return (
    <WorldProvider world={props.world}>
      <AliasProvider aliases={props.aliases}>
        <QueryProvider queries={props.queries}>
          {open ? <Inspector /> : null}
        </QueryProvider>
      </AliasProvider>
    </WorldProvider>
  )
}
