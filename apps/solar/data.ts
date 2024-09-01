import {ref, rel} from "silver-ecs"

type Position = {x: number; y: number}

export let Name = ref<string>("string")
export let Color = ref<string>("string")
export let Radius = ref<number>("f32")
export let Orbits = rel({exclusive: true})
export let Position = ref<Position>({x: "f32", y: "f32"})
export let Angvel = ref<number>("f32")
