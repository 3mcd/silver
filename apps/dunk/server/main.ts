import {Http3Server} from "@fails-components/webtransport"
import {readFile} from "node:fs/promises"
import {createServer} from "node:https"
import {join} from "node:path"
import {App, Query} from "silver-ecs"
import {HasInterest, Interest, Remote, Serde, Server} from "silver-ecs/net"
import {Time} from "silver-ecs/plugins"
import {IsPlayer} from "../plugins/player/plugin"
import {WebTransportRemote} from "../remote"
import {serde} from "../serde"

let key = await readFile("./key.pem", {encoding: "utf8"})
let cert = await readFile("./cert.pem", {encoding: "utf8"})

let mimes: Record<string, string> = {
  wasm: "application/wasm",
  jpg: "image/jpeg",
  js: "text/javascript",
}

let asset_regex = /[^\\]*\.(\w+)$/

let https_server = createServer({key, cert}, async (req, res) => {
  if (req.method === "GET" && req.url?.includes("/assets/")) {
    let asset_match = req.url.match(asset_regex)
    if (asset_match === null) {
      res.writeHead(404)
    } else {
      let asset_filename = asset_match[0]
      let asset_extension = asset_match[1]
      try {
        let content = await readFile(join(process.cwd(), asset_filename))
        res
          .writeHead(200, {
            "content-type": mimes[asset_extension],
          })
          .write(content)
      } catch (err) {
        console.error(err)
        res.writeHead(404)
      }
    }
  } else if (req.method === "GET" && req.url === "/dist/index.js") {
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

let interests = Query.make(Interest)
let players = Query.make(IsPlayer)

let amplify_entities: App.System = world => {
  world.for_each(interests, interest => {
    world.for_each(players, player => {
      interest.amplify(player, 0.1)
    })
  })
}

let game = App.make()
  .use(Time.plugin)
  .use(Server.plugin)
  .add_resource(Serde.res, serde)
  .add_system(amplify_entities)
  .add_init_system(world => {
    world.with(Interest).spawn()
  })

let handle_web_transport_session = (wt: WebTransport) => {
  let world = game.world()
  let interest = world.single(Interest)
  let client = world
    .with(Remote, new WebTransportRemote(wt))
    .with(IsPlayer)
    .with(HasInterest(interest))
    .spawn()
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

setInterval(() => {
  game.run()
}, 1000 / 60)
