import {app} from "silver-ecs"
import {Client, Remote, Transport} from "silver-ecs/net"
import {Time, Timestep, Timesync} from "silver-ecs/plugins"
import {io} from "socket.io-client"
import {SocketIOTransport} from "./transport"

let socket = io({
  transportOptions: {
    webtransport: {
      hostname: "127.0.0.1",
    },
  },
})

let game = app()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Timesync.plugin)
  .use(Client.plugin)
  .add_init_system(world => {
    world.with(Remote).with(Transport, new SocketIOTransport(socket)).spawn()
  })

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}
loop()
