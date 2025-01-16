import {System} from "../../../../app"
import * as Buffer from "../../../../buffer"
import {make as query} from "../../../../query_builder"
import {Remote} from "../../client/components"
import {Transport} from "../../../transport"

let clients = query().with(Remote).with(Transport)

export let recv_messages: System = world => {
  world.for_each(clients, client_transport => {
    let buffer: Buffer.T | undefined
    while ((buffer = client_transport.recv()) !== undefined) {
      // recv_message(buffer, world)
    }
  })
}
