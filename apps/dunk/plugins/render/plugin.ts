import {Plugin} from "silver-ecs"

import createContext from "pex-context"
import {mat4} from "pex-math"
import {cube} from "primitive-geometry"
import {basic_frag} from "./shaders/basic.frag"
import {basic_vert} from "./shaders/basic.vert"

let width = 640
let height = 480
let ctx = createContext({width, height})
let geom = cube()

let clear_cmd = {
  pass: ctx.pass({
    clearColor: [0.2, 0.2, 0.2, 1],
    clearDepth: 1,
  }),
}

let draw_cmd = {
  pipeline: ctx.pipeline({
    depthTest: true,
    vert: basic_vert,
    frag: basic_frag,
  }),
  attributes: {
    a_position: ctx.vertexBuffer(geom.positions),
    a_normal: ctx.vertexBuffer(geom.normals),
  },
  indices: ctx.indexBuffer(geom.cells),
  uniforms: {
    u_projection_matrix: mat4.perspective(
      mat4.create(),
      Math.PI / 4,
      width / height,
      0.1,
      100,
    ),
    u_view_matrix: mat4.lookAt(mat4.create(), [2, 2, 5], [0, 0, 0], [0, 1, 0]),
  },
}

let render = () => {
  ctx.submit(clear_cmd)
  ctx.submit(draw_cmd)
}

export let plugin: Plugin = app => {
  app.add_system(render)
}
