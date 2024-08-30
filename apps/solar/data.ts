import {ref, rel} from "silver-ecs"

type Position = {x: number; y: number}

export const Name = ref<string>("string")
export const Color = ref<string>("string")
export const Radius = ref<number>("f32")
export const Orbits = rel({exclusive: true})
export const Position = ref<Position>({x: "f32", y: "f32"})
