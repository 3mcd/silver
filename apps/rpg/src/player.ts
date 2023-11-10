import * as ecs from "silver-ecs"
import * as lib from "silver-lib"
import * as three from "three"
import {Player} from "./schema"

export let spawn_player_system: ecs.System = world => {
  let geometry = new three.BoxGeometry(1, 1, 1)
  let material = new three.MeshNormalMaterial()
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      for (let k = 0; k < 10; k++) {
        world.spawn(
          Player,
          geometry,
          material,
          {
            x: i * 2,
            y: j * 2,
            z: k * 2,
          },
          {x: 0, y: 0, z: 0},
          {x: 0, y: 0, z: 0},
        )
      }
    }
  }
  return () => {}
}

export let player_input_system: ecs.System = world => {
  let players = ecs.query(world, lib.Velocity, ecs.Is(Player))
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
    players.each((_, v) => {
      let vx = 0
      let vy = 0
      if (keys.has("ArrowLeft")) vx -= 1
      if (keys.has("ArrowRight")) vx += 1
      if (keys.has("ArrowUp")) vy -= 1
      if (keys.has("ArrowDown")) vy += 1
      v.x = vx
      v.y = vy
    })
  }
}
