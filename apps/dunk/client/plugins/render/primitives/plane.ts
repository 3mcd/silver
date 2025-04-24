import {vec3} from "gl-matrix"
import {regl} from "../regl"
import {frag, vert} from "../shaders/plane"

type Uniforms = {
  u_tile_size: number
  u_offset: vec3
}

type Attributes = {
  a_position: number[]
}

export let plane = regl<Uniforms, Attributes, Uniforms>({
  frag,
  vert,
  attributes: {
    a_position: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
  },
  uniforms: {
    u_tile_size: regl.prop<Uniforms, "u_tile_size">("u_tile_size"),
    u_offset: regl.prop<Uniforms, "u_offset">("u_offset"),
  },
  count: 6,
})
