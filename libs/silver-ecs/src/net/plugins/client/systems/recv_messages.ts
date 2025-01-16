import {System} from "../../../../app"
import * as Buffer from "../../../../buffer"
import * as QueryBuilder from "../../../../query_builder"
import * as World from "../../../../world"
import * as Message from "../../../message"
import * as Protocol from "../../../protocol"
import {Transport} from "../../../transport"
import {Remote} from "../components"

let remotes = QueryBuilder.make().with(Remote).with(Transport)

let recv_identity = (buffer: Buffer.T, world: World.T) => {
  let client_id = Protocol.identity.decode(buffer, world)
  world.identify(client_id)
}

let recv_message = (buffer: Buffer.T, world: World.T) => {
  switch (Message.type(buffer)) {
    case Protocol.MessageType.Identity:
      recv_identity(buffer, world)
      break
  }
}

export let recv_messages: System = world => {
  world.for_each(remotes, transport => {
    let buffer: Buffer.T | undefined
    while ((buffer = transport.recv()) !== undefined) {
      recv_message(buffer, world)
    }
  })
}
