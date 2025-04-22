import {vec2} from "gl-matrix"
import Regl from "regl"
import {App, Range, Selector, System} from "silver-ecs"
import {Timestep} from "silver-ecs/plugins"
import {Position} from "../physics/data"
import {IsPlayer} from "../player/plugin"
import * as triangle_shader from "./shaders/triangle"

let regl = Regl()

type Uniforms = {
  u_color: string
  u_offset: vec2
  u_viewport_w: number
  u_viewport_h: number
}

let triangle_props = {
  u_color: [0, 0, 0, 1],
  u_offset: [0, 0],
}

const triangle = regl<Uniforms>({
  frag: triangle_shader.frag,
  vert: triangle_shader.vert,
  attributes: {
    a_position: regl.buffer([
      [-0.866, -0.5],
      [0.866, -0.5],
      [0, 1],
    ]),
  },
  uniforms: {
    u_color: regl.prop<Uniforms, "u_color">("u_color"),
    u_offset: regl.prop<Uniforms, "u_offset">("u_offset"),
    u_viewport_w: regl.context("viewportWidth"),
    u_viewport_h: regl.context("viewportHeight"),
  },
  count: 3,
})

let clear_opts: Regl.ClearOptions = {
  color: [0, 0, 0, 0],
  depth: 1,
}

let clear: App.System = () => {
  regl.clear(clear_opts)
}

let draw_player = (position: Position, step: number) => {
  triangle_props.u_color[0] = Math.cos(0.02 * (0.001 * step))
  triangle_props.u_color[1] = Math.sin(0.02 * (0.02 * step))
  triangle_props.u_color[2] = Math.cos(0.02 * (0.3 * step))
  triangle_props.u_offset[0] = position.x / 10
  triangle_props.u_offset[1] = position.y / 10
  triangle(triangle_props)
}

let players = Selector.make(IsPlayer).with(Position)

let draw_players: App.System = world => {
  let step = world.get_resource(Timestep.res).step()
  world.for_each(players, position => {
    draw_player(position, step)
  })
}

let render = Range.make(System.after(Timestep.logical))

export let plugin: App.Plugin = app => {
  app
    .add_system(clear, System.when(render))
    .add_system(draw_players, System.when(render), System.after(clear))
}
