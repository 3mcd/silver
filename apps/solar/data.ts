import * as ecs from "silver-ecs"
import json from "./data.json"

type Orbit = {radius: number; period: number}
type Position = {x: number; y: number}

export const Name = ecs.value<string>()
export const Color = ecs.value<string>()
export const Radius = ecs.value<number>()
export const Orbits = ecs.valueRelation<Orbit>(ecs.Topology.Exclusive)
export const Position = ecs.value<Position>()

export const Body = ecs.type(Name, Color, Radius, Position)
export const Satellite = ecs.type(Body, Orbits)

const types = {Body, Satellite} as const

type Data = {[K in keyof typeof types]: ecs.Data<(typeof types)[K]>[]}
const keys = Object.keys(types) as Array<keyof typeof types>

export const seed = (world: ecs.World, data = json as Data) => {
  const entities: Record<string, ecs.Entity> = {}
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
