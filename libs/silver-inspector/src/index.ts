import React from "react"
import {createRoot} from "react-dom/client"
import {Query, World} from "silver-ecs"
import App from "./app"
import {Aliases, makeDebugAliases} from "./context/alias_context"

export {makeDebugAliases}

export let mount = (
  world: World,
  element: HTMLElement,
  aliases?: Aliases,
  queries?: {[name: string]: Query},
) => {
  createRoot(element).render(
    React.createElement(App, {world, aliases, queries}),
  )
}
