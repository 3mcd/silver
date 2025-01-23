import {app} from "silver-ecs"
import {Client, Remote, Serde, Transport} from "silver-ecs/net"
import {Time, Timestep, Timesync} from "silver-ecs/plugins"
import {Player, Render} from "../plugins"
import {serde} from "../serde"
import {WebTransportTransport} from "../transport"

let wt = new WebTransport(`https://127.0.0.1:3000/transport`)

let game = app()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Timesync.plugin)
  .use(Client.plugin)
  .use(Render.plugin)
  .add_resource(Serde.res, serde)
  .add_init_system(world => {
    world.with(Remote).with(Transport, new WebTransportTransport(wt)).spawn()
  })
  .add_init_system(world => {
    world.with(Player.Player).spawn()
  })

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}
loop()
