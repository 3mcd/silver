import {makeDebugAliases, mount} from "silver-inspector"
import {world} from "./world"
import * as S from "silver-ecs"
import {CellOf, Grid, InCell, Rect} from "./grid"
import {Graphics, Sprite} from "./render"
import {Bunny} from "./bunny"

if (window.matchMedia) {
  const mode = window.matchMedia("(prefers-color-scheme: dark)")
  const onChange = (event: MediaQueryList | MediaQueryListEvent) =>
    document.documentElement.classList.add(event.matches ? "dark" : "light")
  onChange(mode)
  mode.addEventListener("change", onChange)
}

let aliases = makeDebugAliases()
  .set(Bunny, "Bunny")
  .set(Sprite, "Sprite")
  .set(Graphics, "Graphics")
  .set(Grid, "Grid")
  .set(Rect, "Rect")
  .set(InCell, "InCell")
  .set(CellOf, "CellOf")

let queries = {
  bunnies: S.query(Bunny),
}

mount(world, document.getElementById("inspector")!, aliases, queries)
