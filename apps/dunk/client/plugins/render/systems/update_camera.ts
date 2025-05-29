import {App} from "silver-ecs"
import {camera_res} from "../resources"

export let update_camera: App.System = world => {
  let camera = world.get_resource(camera_res)
  camera.update()
}
