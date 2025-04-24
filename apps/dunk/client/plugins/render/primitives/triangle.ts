import {vec2} from "gl-matrix"
import {regl} from "../regl"
import {frag, vert} from "../shaders/triangle"

type Uniforms = {
  u_color: string
  u_offset: vec2
}

export let triangle = regl<Uniforms>({
  frag,
  vert,
  attributes: {
    a_position: regl.buffer([
      [-0.5, 0.5, 0],
      [-0.5, -0.5, 0],
      [0.5, -0.5, 0],
    ]),
  },
  uniforms: {
    u_color: regl.prop<Uniforms, "u_color">("u_color"),
    u_offset: regl.prop<Uniforms, "u_offset">("u_offset"),
  },
  count: 3,
})
