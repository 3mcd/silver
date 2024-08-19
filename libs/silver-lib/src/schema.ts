import {ref, tag, type} from "silver-ecs"
import * as structs from "./structs"

export type Vector3 = {
  x: number
  y: number
  z: number
}

export type Quaternion = {
  x: number
  y: number
  z: number
  w: number
}

export let Name = ref("string")

export interface Position extends Vector3 {}
export let Position = ref<Position>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Position(x, y, z),
)

export interface LinearVelocity extends Vector3 {}
export let LinearVelocity = ref<LinearVelocity>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Velocity(x, y, z),
)

export interface AngularVelocity extends Vector3 {}
export let AngularVelocity = ref<AngularVelocity>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Velocity(x, y, z),
)

export interface Rotation extends Quaternion {}
export let Rotation = ref<Rotation>(
  {x: "f64", y: "f64", z: "f64", w: "f64"},
  ({x, y, z, w}) => new structs.Rotation(x, y, z, w || 1),
)

export interface Scale extends Vector3 {}
export let Scale = ref<Scale>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Scale(x, y, z),
)

export let Transform = type(Position, Rotation)
export let Kinetic = type(LinearVelocity, AngularVelocity)

export let DebugSelected = tag()
export let DebugHighlighted = tag()
