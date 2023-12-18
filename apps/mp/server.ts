import {Entity, makeWorld, run} from "silver-ecs"
import {FixedTimestep} from "silver-net"
import {LAG_COMPENSATION_LATENCY, moveKinetics} from "./shared"
import {readFile} from "node:fs/promises"
import {createServer} from "node:https"
import {Server, Socket} from "socket.io"
import {Protocol, ClockSync} from "silver-net"

let port = process.env.PORT || 3000
let fixedTimestep = FixedTimestep.make({
  terimationCondition: FixedTimestep.TerminationCondition.LastUndershoot,
})
let world = makeWorld()
let now = () => performance.now() / 1_000

let handleClockSyncRequest = (
  view: DataView,
  socket: Socket,
  offset: number,
) => {
  let serverTime = now()
  let clientTime = ClockSync.decodeRequest(view, offset)
  let clockSyncResponse = new Uint8Array(
    Protocol.CLOCK_SYNC_RESPONSE_MESSAGE_SIZE,
  )
  let clockSyncResponseView = new DataView(clockSyncResponse.buffer)
  ClockSync.encodeResponse(clockSyncResponseView, 0, clientTime, serverTime)
  socket.send(clockSyncResponse)
  return offset + Protocol.CLOCK_SYNC_REQUEST_MESSAGE_SIZE
}

let handleMessage = (data: Uint8Array, socket: Socket, player: Entity) => {
  let view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 0
  while (offset < data.byteLength) {
    switch (view.getUint8(offset)) {
      case Protocol.CLOCK_SYNC_REQUEST_MESSAGE_TYPE:
        offset = handleClockSyncRequest(view, socket, offset)
        break
    }
  }
}

let handleConnection = (socket: Socket) => {
  let player = world.spawn()
  socket.on("message", (data: Uint8Array) => {
    handleMessage(data, socket, player)
  })
  socket.on("disconnect", () => {
    world.despawn(player)
  })
}

;(async () => {
  let key = await readFile("./key.pem", {encoding: "utf-8"})
  let cert = await readFile("./cert.pem", {encoding: "utf-8"})
  let server = createServer({key, cert})
  let io = new Server(server)
  server.listen(port)
  io.on("connection", handleConnection)
})()

let step = () => {
  world.step()
  run(world, moveKinetics)
}

let loop = () => {
  let serverTime = now()
  let deltaTime = serverTime - previousTime
  FixedTimestep.advance(fixedTimestep, deltaTime, serverTime)
  while (world.tick < fixedTimestep.tick) {
    step()
  }
  previousTime = serverTime
}

let previousTime = now()
FixedTimestep.reset(fixedTimestep, previousTime - LAG_COMPENSATION_LATENCY)
world.reset(fixedTimestep.tick)

setInterval(loop, 1000 / 60)
