import {App, Selector} from "silver-ecs"
import {ClientId} from "silver-ecs/net"
import {Timestep} from "silver-ecs/plugins"
import {camera_res} from "../resources"
import {draw_triangle} from "../primitives/triangle"
import {Physics, Player} from "../../../../plugins"

let players = Selector.make(Player.IsPlayer)
  .with(Physics.Position)
  .with(ClientId)

let player_props = {
  u_color: [0, 0, 0, 1],
  u_offset: [0, 0, 0],
}

let draw_player = (
  position: Physics.Position,
  step: number,
  is_local: boolean,
) => {
  if (is_local) {
    player_props.u_color[0] = Math.cos(0.02 * (0.001 * step))
    player_props.u_color[1] = Math.sin(0.02 * (0.02 * step))
    player_props.u_color[2] = Math.cos(0.02 * (0.3 * step))
  } else {
    player_props.u_color[0] = 255
    player_props.u_color[1] = 255
    player_props.u_color[2] = 255
  }
  player_props.u_offset[0] = position.x
  player_props.u_offset[1] = position.y
  draw_triangle(player_props)
}

export let draw_players: App.System = world => {
  let step = world.get_resource(Timestep.res).step()
  let camera = world.get_resource(camera_res)
  let local_client_id = world.client_id()
  camera.bind(() => {
    world.for_each(players, (player_position, player_client_id) => {
      let is_local = player_client_id === local_client_id
      draw_player(player_position, step, is_local)
    })
  })
}
