import {app} from "silver-ecs"
import {Client, Remote, Transport} from "silver-ecs/net"
import {Time, Timestep, Timesync} from "silver-ecs/plugins"
import {WebTransportTransport} from "./transport"

let wt = new WebTransport(`https://127.0.0.1:3000/transport/`)

let game = app()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Timesync.plugin)
  .use(Client.plugin)
  .add_init_system(world => {
    world.with(Remote).with(Transport, new WebTransportTransport(wt)).spawn()
  })

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}
loop()
