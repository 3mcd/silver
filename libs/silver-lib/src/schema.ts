import {Type, value} from "silver-ecs"
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

let with_initializer = <T extends Type, U, V extends (...args: any[]) => U>(
  type: T,
  initializer: V,
): T & {make: V} => {
  return Object.assign(type, {make: initializer})
}

export interface Position extends Vector3 {}
export let Position = with_initializer(
  value<Position>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Position(x, y, z),
)

export interface LinearVelocity extends Vector3 {}
export let LinearVelocity = with_initializer(
  value<LinearVelocity>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Velocity(x, y, z),
)

export interface AngularVelocity extends Vector3 {}
export let AngularVelocity = with_initializer(
  value<AngularVelocity>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Velocity(x, y, z),
)

export interface Rotation extends Quaternion {}
export let Rotation = with_initializer(
  value<Rotation>({x: "f64", y: "f64", z: "f64", w: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0, w: number = 1) =>
    new structs.Rotation(x, y, z, w),
)
