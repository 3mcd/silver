import {mat3, mat4, vec2, vec3} from "gl-matrix"
import REGL, {DefaultContext, Regl} from "regl"

let RIGHT = new Float32Array([1, 0, 0])
let FRONT = new Float32Array([0, 0, 1])

let damp = (x: number) => {
  let x_d = x * 0.9
  return Math.abs(x_d) < 0.1 ? 0 : x_d
}

let clamp = (x: number, lo: number, hi: number) => {
  return Math.min(Math.max(x, lo), hi)
}

type Uniforms = {
  u_camera_view: mat4
  u_camera_projection: mat4
}

type CameraState = {
  center: vec3
  theta: number
  phi: number
  distance: number
  eye: vec3
  up: vec3
}

enum Drag {
  NONE,
  ROTATE,
  DOLLY,
  PAN,
}

export class Camera {
  #state
  #inject
  #min_distance
  #max_distance
  #dragging
  #d_theta
  #d_phi
  #deltas
  #offset
  #uniforms

  constructor(
    regl: Regl,
    min_distance: number,
    max_distance: number,
    center: vec3,
    theta: number,
    phi: number,
    up: vec3,
  ) {
    this.#uniforms = {
      u_camera_view: mat4.identity(new Float32Array(16)),
      u_camera_projection: mat4.identity(new Float32Array(16)),
    }
    this.#state = {
      center: new Float32Array(center),
      theta: theta,
      phi: phi,
      distance: Math.log(10.0),
      eye: new Float32Array(3),
      up: new Float32Array(up),
    } as CameraState
    this.#min_distance = Math.log(min_distance)
    this.#max_distance = Math.log(max_distance)
    this.#dragging = Drag.NONE
    this.#d_theta = 0
    this.#d_phi = 0
    this.#deltas = vec3.create()
    this.#offset = vec3.create()
    let uniform_keys = Object.keys(this.#uniforms) as (keyof Uniforms)[]
    this.#inject = regl<Uniforms, {}, {}, Uniforms>({
      context: {
        ...this.#uniforms,
        u_camera_projection: context =>
          mat4.perspective(
            this.#uniforms.u_camera_projection,
            Math.PI / 4.0,
            context.viewportWidth / context.viewportHeight,
            0.01,
            1000.0,
          ),
      },
      uniforms: uniform_keys.reduce(
        (uniforms, name) => ({
          ...uniforms,
          [name]: regl.context<DefaultContext & Uniforms, keyof Uniforms>(name),
        }),
        {} as Record<keyof Uniforms, REGL.DynamicVariable<number>>,
      ),
    })
  }

  #on_pointer_down = (event: PointerEvent) => {
    event.preventDefault()
    switch (event.button) {
      case 0: // left button
        this.#dragging = Drag.ROTATE
        break
      case 1: // middle button
        this.#dragging = Drag.DOLLY
        break
      case 2: // right button
        this.#dragging = Drag.PAN
        return
      default:
        return
    }
  }

  #on_pointer_move = (event: PointerEvent) => {
    if (this.#dragging === Drag.NONE) {
      return
    }

    let dx = event.movementX / window.innerWidth
    let dy = event.movementY / window.innerHeight
    let w = Math.max(this.#state.distance, 0.5)

    if (this.#dragging === Drag.ROTATE) {
      this.#d_theta += dx * w
      this.#d_phi += dy * w
    } else if (this.#dragging === Drag.DOLLY) {
      this.#deltas[2] -= dy * w
    } else if (this.#dragging === Drag.PAN) {
      this.#deltas[0] = dx * 20 * w
      this.#deltas[1] = dy * 20 * w
    }
  }

  #on_pointer_up = () => {
    this.#dragging = 0
    this.#d_theta = 0
    this.#d_phi = 0
  }

  #on_wheel = (event: WheelEvent) => {
    this.#deltas[2] += event.deltaY / window.innerHeight
  }

  #on_contextmenu = (event: MouseEvent) => {
    event.preventDefault()
  }

  initialize() {
    document.addEventListener("pointerdown", this.#on_pointer_down)
    document.addEventListener("pointermove", this.#on_pointer_move)
    document.addEventListener("pointerup", this.#on_pointer_up)
    document.addEventListener("wheel", this.#on_wheel)
    document.addEventListener("contextmenu", this.#on_contextmenu)
  }

  dispose() {
    document.removeEventListener("pointerdown", this.#on_pointer_down)
    document.removeEventListener("pointermove", this.#on_pointer_move)
    document.removeEventListener("pointerup", this.#on_pointer_up)
    document.removeEventListener("wheel", this.#on_wheel)
    document.removeEventListener("contextmenu", this.#on_contextmenu)
  }

  update() {
    this.#state.theta += this.#d_theta
    this.#state.phi = clamp(
      this.#state.phi + this.#d_phi,
      -Math.PI / 2.0,
      Math.PI / 2.0,
    )
    this.#state.distance = clamp(
      this.#state.distance + this.#deltas[2],
      this.#min_distance,
      this.#max_distance,
    )

    let sin_phi = Math.sin(this.#state.phi)
    let cos_phi = Math.cos(this.#state.phi)
    let sin_theta = Math.sin(this.#state.theta)
    let cos_theta = Math.cos(this.#state.theta)

    // rotate
    let r = Math.exp(this.#state.distance)
    this.#state.eye[0] = -r * sin_theta * cos_phi
    this.#state.eye[1] = r * sin_phi
    this.#state.eye[2] = r * cos_theta * cos_phi
    mat4.lookAt(
      this.#uniforms.u_camera_view,
      this.#state.eye,
      this.#state.center,
      this.#state.up,
    )

    // translate
    let dx = this.#deltas[0]
    let dy = this.#deltas[1]
    let dz = this.#deltas[2]
    this.#offset[0] += dx * cos_theta - dy * sin_theta * sin_phi
    this.#offset[1] += -dy * cos_phi
    this.#offset[2] += dx * sin_theta + dy * cos_theta * sin_phi
    mat4.translate(
      this.#uniforms.u_camera_view,
      this.#uniforms.u_camera_view,
      this.#offset,
    )

    this.#deltas[0] = damp(dx)
    this.#deltas[1] = damp(dy)
    this.#deltas[2] = damp(dz)
    this.#d_theta = damp(this.#d_theta)
    this.#d_phi = damp(this.#d_phi)
  }

  bind(block: REGL.CommandBodyFn) {
    this.#inject(block)
  }
}

export type t = Camera

export let make = (
  regl: Regl,
  min_distance = 0.1,
  max_distance = 1000,
  center: vec3 = [0, 0, 0],
  theta = Math.PI / 2,
  phi = 0,
  up: vec3 = [0, 1, 0],
) => {
  let camera = new Camera(
    regl,
    min_distance,
    max_distance,
    center,
    theta,
    phi,
    up,
  )
  camera.initialize()
  return camera
}
