import * as ecs from "silver-ecs/dev"
import {Position, Velocity} from "./schema"

export let movement_system: ecs.System = world => {
  let entities = ecs.query(world, ecs.t(Position, Velocity))
  return () => {
    entities.each((_, position, velocity) => {
      position.x += velocity.x
      position.y += velocity.y
    })
  }
}
