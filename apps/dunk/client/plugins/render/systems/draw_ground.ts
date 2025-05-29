import {App} from "silver-ecs"
import {draw_plane} from "../primitives/plane"
import {camera_res} from "../resources"
import {vec3} from "gl-matrix"

let plane_props = {
  u_offset: [0, -10, 0] as vec3,
  u_tile_size: 10,
}

export let draw_ground: App.System = world => {
  let camera = world.get_resource(camera_res)
  camera.bind(() => {
    draw_plane(plane_props)
  })
}
