import {System} from "../../../../app"
import * as Buffer from "../../../../buffer"
import * as QueryBuilder from "../../../../query_builder"
import * as World from "../../../../world"
import * as Protocol from "../../../protocol"
import {Remote} from "../../../remote"
import {Transport} from "../../../transport"

let remotes = QueryBuilder.make().with(Remote).with(Transport)

let recv_identity = (buffer: Buffer.T, world: World.T) => {
  let client_id = Protocol.read_identity(buffer)
  world.identify(client_id)
}

let res = [0, 0] as [number, number]

let recv_time_sync_response = (buffer: Buffer.T, world: World.T) => {
  Protocol.read_time_sync_response(buffer, res)
  console.log(res)
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
    let buffer: ArrayBuffer | undefined
    while ((buffer = transport.recv()) !== undefined) {
      recv_message(Buffer.make(buffer), world)
    }
  })
}
