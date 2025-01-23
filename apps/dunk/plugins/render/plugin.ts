import {Controls, PerspectiveCamera} from "cameras"
import {ControlsOptions} from "cameras/types/types"
import {
  Attachment,
  Attribute,
  BindGroup,
  BindGroupLayout,
  Buffer,
  Command,
  Context,
  GPUIndexFormat,
  GPUShaderStage,
  Pass,
  Pipeline,
  Sampler,
  Texture,
  Uniform,
  WGSLBuiltIn,
} from "dgel"
import {mat4} from "gl-matrix"
import {cube} from "primitive-geometry"
import {after, Plugin, query, range, ref, System, when} from "silver-ecs"
import typedArrayInterleave from "typed-array-interleave"

import typedArrayConcat from "typed-array-concat"
import * as Player from "../player/plugin"

// context

let context = new Context()
let context_init = context.init(undefined, undefined, undefined, {
  glslangPath: "/assets/glslang.js",
  twgslPath: "/assets/twgsl.js",
})

if (!(await context_init)) {
  throw new Error("failed to initialize WebGPU")
}

document.body.appendChild(context.canvas)

// camera

let camera = new PerspectiveCamera({
  position: [3, 3, 3],
  fov: Math.PI / 2,
  aspect: 1,
  near: 0.1,
  far: 1000,
})
let camera_controls = new Controls({
  element: context.canvas,
  camera,
  position: camera.position,
  target: camera.target,
  distanceBounds: [camera.near, camera.far],
} as unknown as ControlsOptions)

camera.update()

let on_resize = () => {
  context.resize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
on_resize()

// layouts

let system_bind_group_layout = new BindGroupLayout([
  {
    buffer: {},
    visibility: GPUShaderStage.VERTEX,
    name: "System",
    uniforms: [
      new Uniform("projection_matrix", "mat4"),
      new Uniform("view_matrix", "mat4"),
    ],
  },
])

let mesh_bind_group_layout = new BindGroupLayout([
  {
    buffer: {},
    visibility: GPUShaderStage.VERTEX,
    name: "Mesh",
    uniforms: [new Uniform("model_matrix", "mat4")],
  },
  {
    sampler: {},
    visibility: GPUShaderStage.FRAGMENT,
    name: "u_sampler",
  },
  {
    texture: {},
    visibility: GPUShaderStage.FRAGMENT,
    name: "u_texture",
    dimension: "2d",
  },
])

// buffers

let system_uniforms_buffer = new Buffer()
system_uniforms_buffer.uniformBuffer(
  system_bind_group_layout.getBindGroupSize(),
)

let mesh_uniforms_buffer = new Buffer()
mesh_uniforms_buffer.uniformBuffer(mesh_bind_group_layout.getBindGroupSize())

// bindings

let system_uniform_bind_group = new BindGroup({
  layout: system_bind_group_layout.gpuBindGroupLayout,
  resources: [
    {
      buffer: system_uniforms_buffer.gpuBuffer,
      offset: 0,
      size: system_bind_group_layout.getBindGroupSize(),
    },
  ],
})

let uv_sampler = new Sampler()
let uv_image = document.createElement("img")
uv_image.src = "/assets/uv.jpg"
await uv_image.decode()
let uv_texture = new Texture(null, uv_image)

let mesh_uniform_bind_group = new BindGroup({
  layout: mesh_bind_group_layout.gpuBindGroupLayout,
  resources: [
    {
      buffer: mesh_uniforms_buffer.gpuBuffer,
      offset: 0,
      size: mesh_bind_group_layout.getBindGroupSize(),
    },
    uv_sampler.gpuSampler,
    uv_texture.gpuTexture.createView(),
  ],
})

// geometry

let model_matrix = mat4.create()

let geometry = cube()
let geometry_vertex_buffer = new Buffer()
let geometry_index_buffer = new Buffer()

geometry_vertex_buffer.vertexBuffer(
  typedArrayInterleave(
    Float32Array,
    [3, 3, 2],
    geometry.positions,
    geometry.normals,
    geometry.uvs,
  ),
)
geometry_index_buffer.indexBuffer(new Uint16Array(geometry.cells))

// pipeline

let pipeline = new Pipeline({
  bindGroupLayouts: [system_bind_group_layout, mesh_bind_group_layout],
  ins: [
    new Attribute("position", "vec3"),
    new Attribute("normal", "vec3"),
    new Attribute("uv", "vec2"),
  ],
  outs: [
    WGSLBuiltIn.Position,
    new Attribute("v_normal", "vec3"),
    new Attribute("v_uv", "vec2"),
  ],

  vertex: /* wgsl */ `
var output: Output;
output.v_normal = normal;
output.v_uv = uv;

output.position = system.projection_matrix * system.view_matrix * mesh.model_matrix * vec4<f32>(position, 1.0);

return output;
`,
  fragment: /* wgsl */ `
var out_color: vec4<f32>;
out_color = textureSample(u_texture, u_sampler, v_uv);
return out_color;
`,
})

// command

let clear_command = new Command({
  pass: new Pass(
    "render",
    [new Attachment({r: 0.07, g: 0.07, b: 0.07, a: 1}, {})],
    new Attachment(1, {}),
  ),
})
let draw_geometry_command = new Command({
  pipeline,
  bindGroups: [system_uniform_bind_group, mesh_uniform_bind_group],
  vertexBuffers: [geometry_vertex_buffer],
  indexBuffer: geometry_index_buffer,
  indexFormat: GPUIndexFormat.Uint16,
  count: geometry.cells.length,
})

// ecs

let res = ref<Context>()

let clear: System = world => {}

let players = query().with(Player.Player)

let draw: System = world => {
  camera_controls.update()
  camera.position = camera_controls.position
  camera.target = camera_controls.target
  camera.update()

  system_uniforms_buffer.setSubData(
    0,
    typedArrayConcat(Float32Array, camera.projectionMatrix, camera.viewMatrix),
  )
  mesh_uniforms_buffer.setSubData(0, model_matrix)

  context.render(() => {
    context.submit(clear_command, () => {
      context.submit(draw_geometry_command)
    })
  })
}

let render = range()

export let plugin: Plugin = app => {
  app
    .add_resource(res, context)
    .add_system(clear, when(render))
    .add_system(draw, when(render), after(clear))
}
