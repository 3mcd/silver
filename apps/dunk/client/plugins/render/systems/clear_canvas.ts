import {App} from "silver-ecs"
import {regl} from "../regl"
import Regl from "regl"

let clear_opts: Regl.ClearOptions = {
  color: [0, 0, 0, 0],
  depth: 1,
}

export let clear_canvas: App.System = () => {
  regl.clear(clear_opts)
}
