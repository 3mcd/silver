import {System} from "#app/index"
import * as Buffer from "#buffer"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import {Transport} from "#net/transport"
import {Time, Timesync} from "#plugins/index"
import * as QueryBuilder from "#query_builder"
import * as World from "#world"

let remotes = QueryBuilder.make().with(Remote).with(Transport)

let recv_identity = (buffer: Buffer.T, world: World.T) => {
  let id = Protocol.read_identity(buffer)
  world.identify(id)
}

let time_sync_res = [0, 0] as [number, number]

let recv_time_sync_response = (buffer: Buffer.T, world: World.T) => {
  let time = world.get_resource(Time.res)
  let time_sync = world.get_resource(Timesync.res)
  Protocol.read_time_sync_response(buffer, time_sync_res)
  time_sync.add_sample(time_sync_res, time.t_mono())
}

let recv_message = (buffer: Buffer.T, world: World.T) => {
  switch (Buffer.read_u8(buffer)) {
    case Protocol.MessageType.Identity:
      recv_identity(buffer, world)
      break
    case Protocol.MessageType.TimeSyncResponse:
      recv_time_sync_response(buffer, world)
      break
  }
}

export let recv_messages: System = world => {
  world.for_each(remotes, transport => {
    let packet: Uint8Array | undefined
    while ((packet = transport.recv()) !== undefined) {
      recv_message(Buffer.make(packet.buffer as ArrayBuffer), world)
    }
  })
}
