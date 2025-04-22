import {Component} from "silver-ecs"

export type Position = {x: number; y: number}
export let Position = Component.ref<Position>({x: "f32", y: "f32"})
