import {System, query} from "silver-ecs"
import {Kinetic} from "silver-lib"

export let LAG_COMPENSATION_LATENCY = 0.3

export let moveKinetics: System = world => {
  let kinetics = query(world, Kinetic)
  return () => {
    kinetics.each((_, position, velocity) => {
      position.x += velocity.x
      position.y += velocity.y
    })
  }
}
