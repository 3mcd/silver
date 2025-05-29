import {App, Range, System} from "silver-ecs"
import {Timestep} from "silver-ecs/plugins"
import * as Camera from "./camera"
import {regl} from "./regl"
import {camera_res} from "./resources"
import {clear_canvas} from "./systems/clear_canvas"
import {draw_ground} from "./systems/draw_ground"
import {draw_players} from "./systems/draw_players"
import {update_camera} from "./systems/update_camera"

let render = Range.make(System.after(Timestep.logical))

export let plugin: App.Plugin = app => {
  app
    .add_resource(camera_res, Camera.make(regl))
    .add_system(clear_canvas, System.when(render))
    .add_system(update_camera, System.when(render), System.after(clear_canvas))
    .add_system(draw_players, System.when(render), System.after(update_camera))
    .add_system(draw_ground, System.when(render), System.after(update_camera))
}
