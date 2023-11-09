import * as ecs from "silver-ecs/dev"
import {player_input_system, spawn_player_system} from "./player"
import {movement_system} from "./movement"
import {render_player_system} from "./render"

let world = ecs.make()
let loop = () => {
  requestAnimationFrame(loop)
  world.step()
  ecs.run(world, spawn_player_system)
  ecs.run(world, player_input_system)
  ecs.run(world, movement_system)
  ecs.run(world, render_player_system)
}

requestAnimationFrame(loop)
