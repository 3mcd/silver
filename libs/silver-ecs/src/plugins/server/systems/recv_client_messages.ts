import {System} from "../../../app"
import {Client} from "../components"
import {make as query} from "../../../query_builder"

let clients = query().with(Client)

export let recv_client_messages: System = world => {
  world.for_each(clients, client => {
    client.drain_inbound(ab => {})
  })
}
