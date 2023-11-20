import {useEffect, useState} from "react"
import {World} from "silver-ecs"
import {Stack} from "../styled-system/jsx"
import {Aliases} from "./alias_context"
import {AliasProvider} from "./alias_provider"
import {Heading} from "./components/heading"
import {Tabs} from "./components/tabs"
import "./index.css"
import {Entities} from "./tools/entities"
import {WorldProvider} from "./world_provider"

export type AppProps = {
  world: World
  aliases?: Aliases
}

let Inspector = () => {
  return (
    <Stack height="100%">
      <Tabs.Root defaultValue="entities" width="30vw" height="100%">
        <Tabs.List>
          <Tabs.Trigger key="entities" value="entities">
            Entities
          </Tabs.Trigger>
          <Tabs.Trigger key="systems" value="systems">
            Systems
          </Tabs.Trigger>
          <Tabs.Trigger key="components" value="components">
            Components
          </Tabs.Trigger>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Content value="entities" overflow="hidden">
          <Entities />
        </Tabs.Content>
        <Tabs.Content value="systems">
          <div>Systems</div>
        </Tabs.Content>
        <Tabs.Content value="components">
          <div>Systems</div>
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
        {open ? <Inspector /> : null}
      </AliasProvider>
    </WorldProvider>
  )
}
