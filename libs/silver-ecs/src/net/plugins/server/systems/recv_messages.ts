import {System} from "#app/index"
import * as Buffer from "#buffer"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import * as Time from "#plugins/time/plugin"
import {make as query} from "#selector"
import * as World from "#world"

let clients = query(Remote)

let recv_message = (buffer: Buffer.t, remote: Remote, world: World.t) => {
  switch (buffer.read_u8()) {
    case Protocol.MessageType.TimeSyncRequest:
      let t_origin = Protocol.read_time_sync_request(buffer)
      let t_remote = world.get_resource(Time.res).t_mono()
      let message = Protocol.init_time_sync_response()
      Protocol.write_time_sync_response(message, t_origin, t_remote)
      remote.send(message.end())
  }
}

export let recv_messages: System = world => {
  world.for_each(clients, remote => {
    let data: Uint8Array | undefined
    while ((data = remote.recv()) !== undefined) {
      recv_message(Buffer.make(data.buffer), remote, world)
    }
  })
}
