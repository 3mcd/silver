import * as ecs from "silver-ecs/dev"
import {Player, Velocity} from "./schema"

export let spawn_player_system: ecs.System = world => {
  world.spawn(Player, {x: 0, y: 0}, {x: 0, y: 0})
  return () => {}
}

export let player_input_system: ecs.System = world => {
  let players = ecs.query(world, Velocity, ecs.Is(Player))
  let keys = new Set<string>()
  let on_keydown = (event: KeyboardEvent) => {
    keys.add(event.key)
  }
  let on_keyup = (event: KeyboardEvent) => {
    keys.delete(event.key)
  }
  document.addEventListener("keydown", on_keydown)
  document.addEventListener("keyup", on_keyup)
  return () => {
    players.each((_, player_velocity) => {
      let vx = 0
      let vy = 0
      if (keys.has("ArrowLeft")) {
        vx -= 1
      }
      if (keys.has("ArrowRight")) {
        vx += 1
      }
      if (keys.has("ArrowUp")) {
        vy -= 1
      }
      if (keys.has("ArrowDown")) {
        vy += 1
      }
      player_velocity.x = vx
      player_velocity.y = vy
    })
  }
}
