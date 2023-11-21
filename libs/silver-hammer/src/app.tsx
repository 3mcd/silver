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
      <Tabs.Root defaultValue="entities" width="30vw" height="100%">
        <Tabs.List>
          <Tabs.Trigger key="entities" value="entities">
            Entities
          </Tabs.Trigger>
          <Tabs.Trigger key="queries" value="queries">
            Queries
          </Tabs.Trigger>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content value="entities" height="100%" overflow="hidden">
          <Entities />
        </Tabs.Content>
        <Tabs.Content value="queries" height="100%" overflow="hidden">
          <Queries />
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  )
}

export default function App(props: AppProps) {
  let [open, setOpen] = useState(false)
  useEffect(() => {
    let on_keydown = (e: KeyboardEvent) => {
      if (e.key === "`") {
        setOpen(open => !open)
      }
    }
    document.addEventListener("keydown", on_keydown)
    return () => document.removeEventListener("keydown", on_keydown)
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
