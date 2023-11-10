import {Type, value} from "silver-ecs"
import * as structs from "./structs"

let with_initializer = <T extends Type, U, V extends (...args: any[]) => U>(
  type: T,
  initializer: V,
): T & {make: V} => {
  return Object.assign(type, {make: initializer})
}

export type Position = {x: number; y: number; z: number}
export let Position = with_initializer(
  value<Position>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Position(x, y, z),
)

export type Velocity = {x: number; y: number; z: number}
export let Velocity = with_initializer(
  value<Velocity>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Velocity(x, y, z),
)

export type Rotation = {x: number; y: number; z: number}
export let Rotation = with_initializer(
  value<Rotation>({x: "f64", y: "f64", z: "f64"}),
  (x: number = 0, y: number = 0, z: number = 0) =>
    new structs.Rotation(x, y, z),
)
