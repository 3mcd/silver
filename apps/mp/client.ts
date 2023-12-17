import {makeWorld, run} from "silver-ecs"
import {
  CLOCK_SYNC_REQUEST_MESSAGE_SIZE,
  CLOCK_SYNC_RESPONSE_MESSAGE_SIZE,
  CLOCK_SYNC_RESPONSE_MESSAGE_TYPE,
  ClockSync,
  FixedTimestep,
} from "silver-net"
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
let clockSyncPayload = {clientTime: 0, serverTime: 0}
let clockSyncRequestTime = 0
let timestep = FixedTimestep.make()
let getTime = () => performance.now() / 1_000
let previousTime = 0

let sendClockSyncRequest = (clientTime: number) => {
  let clockSyncRequest = new ArrayBuffer(CLOCK_SYNC_REQUEST_MESSAGE_SIZE)
  let clockSyncRequestView = new DataView(clockSyncRequest)
  ClockSync.encodeRequest(clockSyncRequestView, 0, clientTime)
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
  ClockSync.addSample(clockSync, clockSyncPayload, clientTime)
  // When the clock is synced, reset the timestep to the server time.
  if (status === Status.SyncingClock && clockSync.isSynced) {
    let serverTime =
      ClockSync.estimateServerTime(clockSync, clientTime) +
      LAG_COMPENSATION_LATENCY
    FixedTimestep.reset(timestep, serverTime)
    world.reset(timestep.step)
    status = Status.AwaitingSnapshot
  }
  return offset + CLOCK_SYNC_RESPONSE_MESSAGE_SIZE
}

let onMessage = (data: ArrayBuffer) => {
  let view = new DataView(data)
  let offset = 0
  while (offset < data.byteLength) {
    switch (view.getUint8(offset)) {
      case CLOCK_SYNC_RESPONSE_MESSAGE_TYPE:
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

let loop = () => {
  let clientTime = getTime()
  // Periodically send clock sync requests.
  if (clientTime - clockSyncRequestTime >= CLOCK_SYNC_REQUEST_INTERVAL) {
    sendClockSyncRequest(clientTime)
  }
  // When the clock is synced, advance the timestep in lockstep with the server.
  if (status === Status.AwaitingSnapshot) {
    let serverTime =
      ClockSync.estimateServerTime(clockSync, clientTime) +
      LAG_COMPENSATION_LATENCY
    FixedTimestep.advance(timestep, clientTime - previousTime, serverTime)
  }
  // Catch the simulation up to the approximated server tick.
  while (world.tick < timestep.step) {
    world.step()
    run(world, moveKinetics)
  }
  previousTime = clientTime
  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
