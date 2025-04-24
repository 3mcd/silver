import {Http3Server} from "@fails-components/webtransport"
import {App} from "silver-ecs"
import {Remote, Serde, Server} from "silver-ecs/net"
import {Commands, Time, Timestep} from "silver-ecs/plugins"
import {Physics, Player} from "../plugins"
import {WebTransportRemote} from "../remote"
import {serde} from "../serde"
import {cert, https_server, key} from "./https_server"
import {Net} from "./plugins"

let game = App.make()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Commands.plugin)
  .use(Server.plugin)
  .use(Player.plugin)
  .use(Physics.plugin)
  .use(Net.plugin)
  .add_resource(Serde.res, serde)

setInterval(() => {
  game.run()
}, 1000 / 60)

let port = process.env.PORT || 3000

https_server.listen(port, () => {
  console.log(`server listening at https://localhost:${port}`)
})

let http3_server = new Http3Server({
  port,
  host: "0.0.0.0",
  secret: "changeit",
  cert,
  privKey: key,
})

let handle_web_transport_session = (wt: WebTransport) => {
  let world = game.world()
  let client = world.with(Remote, new WebTransportRemote(wt)).spawn()
  wt.closed.then(() => {
    world.despawn(client)
  })
}

http3_server.startServer()
;(async () => {
  let session_stream = http3_server.sessionStream("/wt")
  let session_reader = session_stream.getReader()

  while (true) {
    let {done, value} = await session_reader.read()
    if (done) {
      break
    }
    if (value) {
      handle_web_transport_session(value as unknown as WebTransport)
    }
  }
})()
