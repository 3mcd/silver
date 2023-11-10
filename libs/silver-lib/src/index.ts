import * as ecs from "silver-ecs"

export type Position = {x: number; y: number; z: number}
export let Position = ecs.value<Position>({x: "f64", y: "f64", z: "f64"})

export type Velocity = {x: number; y: number; z: number}
export let Velocity = ecs.value<Velocity>({x: "f64", y: "f64", z: "f64"})

export type Rotation = {x: number; y: number; z: number}
export let Rotation = ecs.value<Rotation>({
  x: "f64",
  y: "f64",
  z: "f64",
})
