import * as ecs from "silver-ecs"
import * as lib from "silver-lib"

export let movement_system: ecs.System = world => {
  let rotate = ecs.query(world, lib.Rotation)
  let move = ecs.query(world, ecs.type(lib.Position, lib.Velocity))
  return () => {
    move.each((entity, position, velocity) => {
      position.x += velocity.x
      position.y += velocity.y
      world.change(entity, lib.Position, position)
    })
    rotate.each((entity, rotation) => {
      rotation.x += 0.01
      rotation.z += 0.01
      world.change(entity, lib.Rotation, rotation)
    })
  }
}
