import {app} from "silver-ecs"
import {Time, Timestep, Timesync} from "silver-ecs/plugins"
import {Client, Remote, Transport} from "silver-ecs/net"
import {io, Socket} from "socket.io-client"

let socket = io({
  transportOptions: {
    webtransport: {
      hostname: "127.0.0.1",
    },
  },
})

class SocketIOTransport implements Transport {
  #socket
  #inbox

  constructor(socket: Socket) {
    this.#inbox = [] as ArrayBuffer[]
    this.#socket = socket
    this.#socket.on("message", (_, ab: ArrayBuffer) => {
      this.#inbox.push(ab)
    })
  }

  send(ab: ArrayBuffer) {
    this.#socket.send("message", ab)
  }

  recv() {
    return this.#inbox.shift()!
  }
}

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
