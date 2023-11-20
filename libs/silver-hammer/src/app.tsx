import {useEffect, useState} from "react"
import {World} from "silver-ecs"
import {Aliases} from "./alias_context"
import {AliasProvider} from "./alias_provider"
import {Tabs} from "./components/tabs"
import "./index.css"
import {EntityNodes} from "./tools/entities/entity_nodes"
import {WorldProvider} from "./world_provider"
import {Entities} from "./tools/entities"

export type AppProps = {
  world: World
  aliases?: Aliases
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
        <Tabs.Root
          defaultValue="nodes"
          display={open ? "flex" : "none"}
          width="30vw"
          height="100%"
        >
          <Tabs.List>
            <Tabs.Trigger key="nodes" value="nodes">
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
          <Tabs.Content value="nodes" overflow="auto">
            <Entities />
          </Tabs.Content>
          <Tabs.Content value="systems">
            <div>Systems</div>
          </Tabs.Content>
          <Tabs.Content value="components">
            <div>Systems</div>
          </Tabs.Content>
        </Tabs.Root>
      </AliasProvider>
    </WorldProvider>
  )
}
