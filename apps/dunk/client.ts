import {app} from "silver-ecs"
import {Client, Remote, Transport, WebSocketTransport} from "silver-ecs/net"

let ws = new WebSocket(`wss://${window.location.host}/ws`)
let game = app()
  .use(Client.plugin)
  .add_init_system(world => {
    world.with(Remote).with(Transport, WebSocketTransport.make(ws)).spawn()
  })

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}
loop()
