import {System} from "#app/index"
import * as Buffer from "#buffer"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import {Transport} from "#net/transport"
import * as Time from "#plugins/time/plugin"
import {make as query} from "#query_builder"
import * as World from "#world"

let clients = query().with(Remote).with(Transport)

let recv_message = (buffer: Buffer.T, transport: Transport, world: World.T) => {
  switch (Buffer.read_u8(buffer)) {
    case Protocol.MessageType.TimeSyncRequest:
      let t_origin = Protocol.read_time_sync_request(buffer)
      let t_remote = world.get_resource(Time.res).t_mono()
      let response = Protocol.init_time_sync_response()
      Protocol.write_time_sync_response(response, t_origin, t_remote)
      transport.send(Buffer.end(response))
  }
}

export let recv_messages: System = world => {
  world.for_each(clients, client_transport => {
    let packet: Uint8Array | undefined
    while ((packet = client_transport.recv()) !== undefined) {
      recv_message(
        Buffer.make(packet.buffer as ArrayBuffer),
        client_transport,
        world,
      )
    }
  })
}
