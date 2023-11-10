import * as ecs from "silver-ecs"
import * as lib from "silver-lib"

export let movement_system: ecs.System = world => {
  let entities = ecs.query(world, ecs.type(lib.Position, lib.Velocity))
  return () => {
    entities.each((_, position, velocity) => {
      position.x += velocity.x
      position.y += velocity.y
    })
  }
}
