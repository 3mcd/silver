import {System} from "#app/index"
import * as Buffer from "#buffer"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import {Time, Timesync} from "#plugins/index"
import * as Selector from "#selector"
import * as World from "#world"
import * as Client from "../client.ts"

let recv_identity = (buffer: Buffer.t, world: World.t) => {
  let id = Protocol.read_identity(buffer)
  world.identify(id)
}

let time_sync_res = [0, 0] as [number, number]

let recv_time_sync_response = (buffer: Buffer.t, world: World.t) => {
  let time = world.get_resource(Time.res)
  let time_sync = world.get_resource(Timesync.res)
  Protocol.read_time_sync_response(buffer, time_sync_res)
  time_sync.add_sample(time_sync_res, time.t_mono())
}

let recv_message = (buffer: Buffer.t, world: World.t) => {
  switch (buffer.read_u8()) {
    case Protocol.MessageType.Identity:
      recv_identity(buffer, world)
      break
    case Protocol.MessageType.Interest: {
      let client = world.get_resource(Client.res)
      let step = buffer.read_u32()
      client.add_snapshot(buffer, step)
      break
    }
    case Protocol.MessageType.TimeSyncResponse:
      recv_time_sync_response(buffer, world)
      break
  }
}

let remotes = Selector.make().with(Remote)

export let recv_messages: System = world => {
  world.for_each(remotes, remote => {
    let data: Uint8Array | undefined
    while ((data = remote.recv()) !== undefined) {
      recv_message(Buffer.make(data.buffer), world)
    }
  })
}
