import {App, Component, Selector, System} from "silver-ecs"
import {Timestep} from "silver-ecs/plugins"
import * as Physics from "../physics/plugin"

export let IsPlayer = Component.tag()

let players = Selector.make()
  .with("entity")
  .with(Physics.Position)
  .with(IsPlayer)

let move_players: App.System = world => {
  let timestep = world.get_resource(Timestep.res)
  let a = timestep.step() * timestep.period()
  world.for_each(players, (player_entity, player_position) => {
    player_position.x += Math.sin(a) * 0.005 * ((player_entity % 10) + 1)
    player_position.y += Math.cos(a) * 0.005 * ((player_entity % 10) + 1)
  })
}

export let plugin: App.Plugin = app => {
  app.add_system(move_players, System.when(Physics.update))
}
