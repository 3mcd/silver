import * as ecs from "silver-ecs/dev"

export type Position = {x: number; y: number}
export let Position = ecs.value<Position>({x: "f32", y: "f32"})

export type Velocity = {x: number; y: number}
export let Velocity = ecs.value<Velocity>({x: "f32", y: "f32"})

export let Player = ecs.t(Position, Velocity)
