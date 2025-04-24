import {App} from "silver-ecs"
import {Client, Remote, Serde} from "silver-ecs/net"
import {Commands, Time, Timestep, Timesync} from "silver-ecs/plugins"
import {WebTransportRemote} from "../remote"
import {serde} from "../serde"
import {Render} from "./plugins"

let game = App.make()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Timesync.plugin)
  .use(Commands.plugin)
  .use(Client.plugin)
  .use(Render.plugin)
  .add_resource(Serde.res, serde)
  .add_init_system(world => {
    let wt = new WebTransport(`https://127.0.0.1:3000/wt`)
    world.with(Remote, new WebTransportRemote(wt)).spawn()
  })

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}
loop()
