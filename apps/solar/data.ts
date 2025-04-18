import {Component} from "silver-ecs"

type Position = {x: number; y: number}

export let LocalPosition = Component.ref<Position>({x: "f32", y: "f32"})
export let Position = Component.ref<Position>({x: "f32", y: "f32"})
export let Radius = Component.ref<number>("f32")
export let Angvel = Component.ref<number>("f32")
export let Name = Component.ref<string>("string")
export let Color = Component.ref<string>("string")

export let Orbits = Component.rel({exclusive: true})
