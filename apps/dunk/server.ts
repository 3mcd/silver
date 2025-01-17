import {Http3Server} from "@fails-components/webtransport"
import {readFile} from "node:fs/promises"
import {createServer} from "node:https"
import {app} from "silver-ecs"
import {Time} from "silver-ecs/plugins"
import {Remote, Server, Transport} from "silver-ecs/net"
import {Socket, Server as SocketIOServer} from "socket.io"

class SocketIOTransport implements Transport {
  #socket
  #inbox

  constructor(socket: Socket) {
    this.#inbox = [] as ArrayBuffer[]
    this.#socket = socket
    this.#socket.on("message", (_, data: Buffer) => {
      let ab = new ArrayBuffer(data.byteLength)
      data.copy(new Uint8Array(ab))
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

let key = await readFile("./key.pem", {encoding: "utf8"})
let cert = await readFile("./cert.pem", {encoding: "utf8"})

let https_server = createServer({key, cert}, async (req, res) => {
  if (req.method === "GET" && req.url === "/dist/client.js") {
    let content = await readFile("./dist/client.js")
    res.writeHead(200, {"content-type": "text/javascript"}).write(content)
  } else if (req.method === "GET" && req.url === "/") {
    let content = await readFile("./index.html")
    res.writeHead(200, {"content-type": "text/html"}).write(content)
  } else {
    res.writeHead(404)
  }
  res.end()
})

let port = process.env.PORT || 3000

https_server.listen(port, () => {
  console.log(`server listening at https://localhost:${port}`)
})

let socket_io_server = new SocketIOServer(https_server, {
  transports: ["polling", "websocket", "webtransport"],
})

socket_io_server.on("connection", socket => {
  let client = game
    .world()
    .with(Remote)
    .with(Transport, new SocketIOTransport(socket))
    .spawn()
  socket.on("disconnect", () => {
    game.world().despawn(client)
  })
})

let http3_server = new Http3Server({
  port,
  host: "0.0.0.0",
  secret: "changeit",
  cert,
  privKey: key,
})

http3_server.startServer()
;(async () => {
  let session_stream = http3_server.sessionStream("/socket.io/")
  let session_reader = session_stream.getReader()

  while (true) {
    let {done, value} = await session_reader.read()
    if (done) {
      break
    }
    socket_io_server.engine.onWebTransportSession(value)
  }
})()

let game = app().use(Time.plugin).use(Server.plugin)

setInterval(() => {
  game.run()
}, 1000 / 60)
