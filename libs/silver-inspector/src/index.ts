import React from "react"
import {createRoot} from "react-dom/client"
import * as S from "silver-ecs"
import App from "./app"
import {Aliases, makeDebugAliases} from "./context/alias_context"

export {makeDebugAliases}

export let mount = (
  world: S.World,
  element: HTMLElement,
  aliases?: Aliases,
  queries?: {[name: string]: S.Query},
) => {
  createRoot(element).render(
    React.createElement(App, {world, aliases, queries}),
  )
}
