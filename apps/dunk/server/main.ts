import {Http3Server} from "@fails-components/webtransport"
import {WebTransportSessionImpl} from "@fails-components/webtransport/dist/lib/types"
import {readFile} from "node:fs/promises"
import {createServer} from "node:https"
import {app} from "silver-ecs"
import {Remote, Serde, Server, Transport} from "silver-ecs/net"
import {Time} from "silver-ecs/plugins"
import {serde} from "../serde"
import {WebTransportTransport} from "../transport"

let key = await readFile("./key.pem", {encoding: "utf8"})
let cert = await readFile("./cert.pem", {encoding: "utf8"})

let https_server = createServer({key, cert}, async (req, res) => {
  if (req.method === "GET" && req.url === "/dist/index.js") {
    let content = await readFile("./dist/index.js")
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

let http3_server = new Http3Server({
  port,
  host: "0.0.0.0",
  secret: "changeit",
  cert,
  privKey: key,
})

let game = app()
  .use(Time.plugin)
  .use(Server.plugin)
  .add_resource(Serde.res, serde)

let handle_web_transport_session = (session: WebTransportSessionImpl) => {
  let client = game
    .world()
    .with(Remote)
    .with(
      Transport,
      new WebTransportTransport(session as unknown as WebTransport),
    )
    .spawn()
  session.closed.then(() => {
    game.world().despawn(client)
  })
}

http3_server.startServer()
;(async () => {
  let session_stream = http3_server.sessionStream("/transport")
  let session_reader = session_stream.getReader()

  while (true) {
    let {done, value} = await session_reader.read()
    if (done) {
      break
    }
    if (value) {
      handle_web_transport_session(value)
    }
  }
})()

setInterval(() => {
  game.run()
}, 1000 / 60)
