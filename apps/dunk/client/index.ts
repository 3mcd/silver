import {app} from "silver-ecs"
import {Client, Remote, Serde} from "silver-ecs/net"
import {Time, Timestep, Timesync} from "silver-ecs/plugins"
import {Player, Render} from "../plugins"
import {serde} from "../serde"
import {WebTransportRemote} from "../transport"

let game = app()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Timesync.plugin)
  .use(Client.plugin)
  .use(Render.plugin)
  .add_resource(Serde.res, serde)
  .add_init_system(world => {
    let wt = new WebTransport(`https://127.0.0.1:3000/wt`)
    world.with(Remote, new WebTransportRemote(wt)).spawn()
  })
  .add_init_system(world => {
    world.with(Player.IsPlayer).spawn()
  })

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}
loop()
