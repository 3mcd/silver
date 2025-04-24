import {mat4, vec3} from "gl-matrix"
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

type CameraState = {
  view: mat4
  projection: mat4
  center: vec3
  theta: number
  phi: number
  distance: number
  eye: vec3
  up: vec3
}

export class Camera {
  #state
  #inject
  #min_distance
  #max_distance
  #prev_x
  #prev_y
  #dragging
  #d_distance
  #d_theta
  #d_phi

  constructor(
    regl: Regl,
    min_distance: number,
    max_distance: number,
    center: number,
    theta: number,
    phi: number,
    up: vec3,
  ) {
    this.#state = {
      view: mat4.identity(new Float32Array(16)),
      projection: mat4.identity(new Float32Array(16)),
      center: new Float32Array(center),
      theta: theta,
      phi: phi,
      distance: Math.log(10.0),
      eye: new Float32Array(3),
      up: new Float32Array(up),
    } as CameraState
    this.#min_distance = Math.log(min_distance)
    this.#max_distance = Math.log(max_distance)
    this.#dragging = false
    this.#d_distance = 0
    this.#d_theta = 0
    this.#d_phi = 0
    this.#prev_x = 0
    this.#prev_y = 0
    let uniform_keys = Object.keys(this.#state) as (keyof CameraState)[]
    this.#inject = regl<CameraState, {}, {}, CameraState>({
      context: {
        ...this.#state,
        projection: context => {
          return mat4.perspective(
            this.#state.projection,
            Math.PI / 4.0,
            context.viewportWidth / context.viewportHeight,
            0.01,
            1000.0,
          )
        },
      },
      uniforms: uniform_keys.reduce((uniforms, name) => {
        uniforms[name] = regl.context<
          DefaultContext & CameraState,
          keyof CameraState
        >(name)
        return uniforms
      }, {} as Record<keyof CameraState, REGL.DynamicVariable<number>>),
    })
  }

  #on_pointer_down = (event: PointerEvent) => {
    if (event.button === 0) {
      this.#dragging = true
      this.#prev_x = event.clientX
      this.#prev_y = event.clientY
    }
  }

  #on_pointer_move = (event: PointerEvent) => {
    if (this.#dragging) {
      const dx = (event.clientX - this.#prev_x) / window.innerWidth
      const dy = (event.clientY - this.#prev_y) / window.innerHeight
      const w = Math.max(this.#state.distance, 0.5)

      this.#d_theta += w * dx
      this.#d_phi += w * dy

      this.#prev_x = event.clientX
      this.#prev_y = event.clientY
    }
  }

  #on_pointer_up = (event: PointerEvent) => {
    if (event.button === 0) {
      this.#dragging = false
      this.#d_theta = 0
      this.#d_phi = 0
    }
  }

  #on_wheel = (event: WheelEvent) => {
    this.#d_distance += event.deltaY / window.innerHeight
  }

  initialize() {
    document.addEventListener("pointerdown", this.#on_pointer_down)
    document.addEventListener("pointermove", this.#on_pointer_move, {
      passive: true,
    })
    document.addEventListener("pointerup", this.#on_pointer_up)
    document.addEventListener("wheel", this.#on_wheel)
  }

  dispose() {
    document.removeEventListener("pointerdown", this.#on_pointer_down)
    document.removeEventListener("pointermove", this.#on_pointer_move)
    document.removeEventListener("pointerup", this.#on_pointer_up)
    document.removeEventListener("wheel", this.#on_wheel)
  }

  update() {
    this.#state.theta += this.#d_theta
    this.#state.phi = clamp(
      this.#state.phi + this.#d_phi,
      -Math.PI / 2.0,
      Math.PI / 2.0,
    )
    this.#state.distance = clamp(
      this.#state.distance + this.#d_distance,
      this.#min_distance,
      this.#max_distance,
    )

    this.#d_theta = damp(this.#d_theta)
    this.#d_phi = damp(this.#d_phi)
    this.#d_distance = damp(this.#d_distance)

    let theta = this.#state.theta
    let phi = this.#state.phi
    let r = Math.exp(this.#state.distance)

    let v_front = r * Math.sin(theta) * Math.cos(phi)
    let v_right = r * Math.cos(theta) * Math.cos(phi)
    let v_up = r * Math.sin(phi)

    for (let i = 0; i < 3; ++i) {
      this.#state.eye[i] =
        this.#state.center[i] +
        v_front * FRONT[i] +
        v_right * RIGHT[i] +
        v_up * this.#state.up[i]
    }

    mat4.lookAt(
      this.#state.view,
      this.#state.eye,
      this.#state.center,
      this.#state.up,
    )
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
  center = 3,
  theta = 0,
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
