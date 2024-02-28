import * as S from "silver-ecs"
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

export let Name = S.ref("string")

export interface Position extends Vector3 {}
export let Position = S.ref<Position>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Position(x, y, z),
)

export interface LinearVelocity extends Vector3 {}
export let LinearVelocity = S.ref<LinearVelocity>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Velocity(x, y, z),
)

export interface AngularVelocity extends Vector3 {}
export let AngularVelocity = S.ref<AngularVelocity>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Velocity(x, y, z),
)

export interface Rotation extends Quaternion {}
export let Rotation = S.ref<Rotation>(
  {x: "f64", y: "f64", z: "f64", w: "f64"},
  ({x, y, z, w}) => new structs.Rotation(x, y, z, w || 1),
)

export interface Scale extends Vector3 {}
export let Scale = S.ref<Scale>(
  {x: "f64", y: "f64", z: "f64"},
  ({x, y, z}) => new structs.Scale(x, y, z),
)

export let Transform = S.type(Position, Rotation)
export let Kinetic = S.type(LinearVelocity, AngularVelocity)

export let DebugSelected = S.tag()
export let DebugHighlighted = S.tag()
