import {App} from "silver-ecs"
import {plane} from "../primitives/plane"
import {camera_res} from "../resources"

export let draw_ground: App.System = world => {
  let camera = world.get_resource(camera_res)
  camera.bind(() => {
    plane({
      u_offset: [0, -10, 0],
      u_tile_size: 10,
    })
  })
}
