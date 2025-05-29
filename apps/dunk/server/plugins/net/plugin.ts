import {App, Effect, Selector, System} from "silver-ecs"
import {Interest, InterestedIn, Remote} from "silver-ecs/net"
import {Timestep} from "silver-ecs/plugins"
import {Physics, Player} from "../../../plugins"

let interests = Selector.make(Player.IsPlayer)
  .with("entity")
  .with(Physics.Position)
  .with(InterestedIn, interest => interest.with(Interest))

let bodies = Selector.make().with("entity").with(Physics.Position)

let distance = (p1: Physics.Position, p2: Physics.Position) => {
  let dx = p2.x - p1.x
  let dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

let amplify_players: App.System = world => {
  world.for_each(
    interests,
    (player_entity, player_position, player_interest) => {
      world.for_each(bodies, (body_entity, body_position) => {
        if (player_entity === body_entity) {
          player_interest.amplify(body_entity, 1)
          return
        }
        let d = distance(player_position, body_position)
        let a =
          d >= 4
            ? // hide bodies further than 4m away
              0
            : // amplify entities by a factor inversely proportional to their
              // distance from the player
              1 / d
        player_interest.amplify(body_entity, a)
      })
    },
  )
}

let init_clients = Effect.make([Remote], (world, entity) => {
  let interest = world.with(Interest).spawn()
  world
    .with(Player.IsPlayer)
    .with(Physics.Position, {
      x: (0.5 - Math.random()) * 10,
      y: (0.5 - Math.random()) * 10,
    })
    .with(InterestedIn(interest))
    .add(entity)
})

export let plugin: App.Plugin = app => {
  app
    .add_system(
      amplify_players,
      System.when(Timestep.logical),
      System.after(Physics.update),
    )
    .add_effect(init_clients)
}
