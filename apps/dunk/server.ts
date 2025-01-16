import {readFile} from "node:fs/promises"
import {createServer} from "node:https"
import {Server} from "socket.io"
import {Http3Server} from "@fails-components/webtransport"

const key = await readFile("./key.pem", {encoding: "utf8"})
const cert = await readFile("./cert.pem", {encoding: "utf8"})

const httpsServer = createServer(
  {
    key,
    cert,
  },
  async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      const content = await readFile("./index.html")
      res.writeHead(200, {
        "content-type": "text/html",
      })
      res.write(content)
      res.end()
    } else {
      res.writeHead(404).end()
    }
  },
)

const port = process.env.PORT || 3000

httpsServer.listen(port, () => {
  console.log(`server listening at https://localhost:${port}`)
})

const io = new Server(httpsServer, {
  transports: ["polling", "websocket", "webtransport"],
})

io.on("connection", socket => {
  console.log(`connected with transport ${socket.conn.transport.name}`)

  socket.conn.on("upgrade", transport => {
    console.log(`transport upgraded to ${transport.name}`)
  })

  socket.on("disconnect", reason => {
    console.log(`disconnected due to ${reason}`)
  })
})

const h3Server = new Http3Server({
  port,
  host: "0.0.0.0",
  secret: "changeit",
  cert,
  privKey: key,
})

h3Server.startServer()
;(async () => {
  const stream = await h3Server.sessionStream("/socket.io/")
  const sessionReader = stream.getReader()

  while (true) {
    const {done, value} = await sessionReader.read()
    if (done) {
      break
    }
    io.engine.onWebTransportSession(value)
  }
})()

// import {app} from "silver-ecs"
// import {Server, Remote, Transport, WebSocketTransport} from "silver-ecs/net"

// let game = app().use(Server.plugin)

// setInterval(() => {
//   game.run()
// }, 1000 / 60)
