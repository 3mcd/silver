import {makeWorld, run} from "silver-ecs"
import {Protocol, ClockSync, FixedTimestep} from "silver-net"
import {io} from "socket.io-client"
import {LAG_COMPENSATION_LATENCY, moveKinetics} from "./shared"

enum Status {
  Connecting,
  SyncingClock,
  AwaitingSnapshot,
  Disconnected,
}

let CLOCK_SYNC_REQUEST_INTERVAL = 0.1

let world = makeWorld()
let socket = io("https://localhost:3000", {
  rejectUnauthorized: false,
  transports: ["websocket"],
})
let status = Status.Connecting
let clockSync = ClockSync.make()
let clockSyncPayload: ClockSync.OffsetSample = {
  client_time: 0,
  server_time: 0,
}
let clockSyncRequestTime = 0
let fixedTimestep = FixedTimestep.make()
let getTime = () => performance.now() / 1_000
let previousTime = 0

let sendClockSyncRequest = (clientTime: number) => {
  let clockSyncRequest = new ArrayBuffer(
    Protocol.CLOCK_SYNC_REQUEST_MESSAGE_SIZE,
  )
  let clockSyncRequestView = new DataView(clockSyncRequest)
  ClockSync.encode_request(clockSyncRequestView, 0, clientTime)
  socket.send(clockSyncRequest)
  clockSyncRequestTime = clientTime
}

let handleClockSyncResponse = (
  view: DataView,
  offset: number,
  clockSync: ClockSync.T,
) => {
  let clientTime = getTime()
  ClockSync.decodeResponse(view, offset, clockSyncPayload)
  ClockSync.add_sample(clockSync, clockSyncPayload, clientTime)
  // When the clock is synced, reset the fixed timestep and world to the
  // estimated server time.
  if (status === Status.SyncingClock && ClockSync.is_synced(clockSync)) {
    let serverTime =
      ClockSync.estimate_server_time(clockSync, clientTime) +
      LAG_COMPENSATION_LATENCY
    FixedTimestep.reset(fixedTimestep, serverTime)
    world.reset(fixedTimestep.tick)
    status = Status.AwaitingSnapshot
  }
  return offset + Protocol.CLOCK_SYNC_RESPONSE_MESSAGE_SIZE
}

let onMessage = (data: ArrayBuffer) => {
  let view = new DataView(data)
  let offset = 0
  while (offset < data.byteLength) {
    switch (view.getUint8(offset)) {
      case Protocol.CLOCK_SYNC_RESPONSE_MESSAGE_TYPE:
        offset = handleClockSyncResponse(view, offset, clockSync)
        break
    }
  }
}

socket.on("connect", () => {
  status = Status.SyncingClock
})
socket.on("disconnect", () => {
  status = Status.Disconnected
})
socket.on("message", onMessage)

let step = () => {
  world.step()
  run(world, moveKinetics)
}

let loop = () => {
  let clientTime = getTime()
  // Periodically send clock sync requests.
  if (clientTime - clockSyncRequestTime >= CLOCK_SYNC_REQUEST_INTERVAL) {
    sendClockSyncRequest(clientTime)
  }
  // When the clock is synced, advance the timestep in lockstep with the server.
  if (status === Status.AwaitingSnapshot) {
    let serverTime =
      ClockSync.estimate_server_time(clockSync, clientTime) +
      LAG_COMPENSATION_LATENCY
    FixedTimestep.advance(fixedTimestep, clientTime - previousTime, serverTime)
  }
  // Catch the simulation up to the approximated server tick.
  while (world.tick < fixedTimestep.tick) {
    step()
  }
  previousTime = clientTime
  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
