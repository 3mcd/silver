import * as S from "silver-ecs"
import {Name} from "silver-lib"
import json from "./data.json"

type Orbit = {radius: number; period: number}
type Position = {x: number; y: number}

export const Color = S.value<string>("string")
export const Radius = S.value<number>("f32")
export const Orbits = S.valueRelation<Orbit>(
  {radius: "f32", period: "f32"},
  S.Topology.Exclusive,
)
export const Position = S.value<Position>({x: "f32", y: "f32"})

export const Body = S.type(Name, Color, Radius, Position)
export const Satellite = S.type(Body, Orbits)

const types = {Body, Satellite} as const

type Data = {[K in keyof typeof types]: S.Data<(typeof types)[K]>[]}
const keys = Object.keys(types) as (keyof typeof types)[]

export const seed = (world: S.World, data = json as Data) => {
  const entities: Record<string, S.Entity> = {}
  for (const key of keys) {
    switch (key) {
      case "Body":
        for (let i = 0; i < data[key].length; i++) {
          const init = data[key][i]
          entities[init[0]] = world.spawn(Body, ...init)
        }
        break
      case "Satellite":
        for (let i = 0; i < data[key].length; i++) {
          const init = data[key][i]
          const name = init[0]
          init[4][0] = entities[init[4][0]]
          entities[name] = world.spawn(Satellite, ...init)
        }
        break
    }
  }
}
