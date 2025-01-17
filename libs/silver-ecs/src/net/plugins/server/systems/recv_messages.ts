import {System} from "../../../../app"
import * as Buffer from "../../../../buffer"
import {make as query} from "../../../../query_builder"
import {Remote} from "../../../remote"
import {Transport} from "../../../transport"
import * as World from "../../../../world"
import * as Protocol from "../../../protocol"
import * as Time from "../../../../plugins/time/plugin"

let clients = query().with(Remote).with(Transport)

let recv_message = (buffer: Buffer.T, transport: Transport, world: World.T) => {
  console.log(Buffer.peek_u8(buffer))
  switch (Buffer.read_u8(buffer)) {
    case Protocol.MessageType.TimeSyncRequest:
      const t_mono_origin = Protocol.read_time_sync_request(buffer)
      const t_mono_remote = world.get_resource(Time.res).t_mono()
      const response = Protocol.init_time_sync_response()
      console.log(t_mono_origin, t_mono_remote)
      Protocol.write_time_sync_response(response, t_mono_origin, t_mono_remote)
      transport.send(Buffer.end(response))
  }
}

export let recv_messages: System = world => {
  world.for_each(clients, client_transport => {
    let ab: ArrayBuffer | undefined
    while ((ab = client_transport.recv()) !== undefined) {
      recv_message(Buffer.make(ab), client_transport, world)
    }
  })
}
