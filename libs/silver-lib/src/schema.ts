import {Type, tag, type, value} from "silver-ecs"
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

let withInitializer = <T extends Type, U, V extends (...args: any[]) => U>(
  type: T,
  initializer: V,
): T & {make: V} => {
  return Object.assign(type, {
    make: initializer,
  })
}

export interface Position extends Vector3 {}
export let Position = withInitializer(
  value<Position>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Position(x, y, z),
)

export interface LinearVelocity extends Vector3 {}
export let LinearVelocity = withInitializer(
  value<LinearVelocity>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Velocity(x, y, z),
)

export interface AngularVelocity extends Vector3 {}
export let AngularVelocity = withInitializer(
  value<AngularVelocity>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Velocity(x, y, z),
)

export interface Rotation extends Quaternion {}
export let Rotation = withInitializer(
  value<Rotation>({x: "f64", y: "f64", z: "f64", w: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0, w: number = 1) =>
    new structs.Rotation(x, y, z, w),
)

export interface Scale extends Vector3 {}
export let Scale = withInitializer(
  value<Scale>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 1, y: number = x, z: number = x) => new structs.Scale(x, y, z),
)

export let Transform = type(Position, Rotation)
export let Kinetic = type(LinearVelocity, AngularVelocity)

export let DebugSelected = tag() // 6
export let DebugHighlighted = tag() // 7
