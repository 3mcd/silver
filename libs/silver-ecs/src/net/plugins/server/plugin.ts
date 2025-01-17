import {App, range, when} from "../../../app"
import * as Buffer from "../../../buffer"
import * as Effect from "../../../effect"
import * as Protocol from "../../protocol"
import {Remote} from "../../remote"
import {Transport} from "../../transport"
import {recv_messages} from "./systems/recv_messages"
import * as Server from "./server"
import {ref} from "../../../component"

export let res = ref<Server.T>()
export let recv = range()
export let send = range()

let ClientId = ref<number>()

let identify_clients_effect = Effect.make(
  [Remote, Transport],
  (world, entity) => {
    let server = world.get_resource(res)
    let client_id = Server.make_client_id(server)
    let client_transport = world.get(entity, Transport)
    let buffer = Protocol.init_identity()
    world.add(entity, ClientId, client_id)
    Protocol.write_identity(buffer, client_id)
    client_transport.send(Buffer.end(buffer))
  },
  (world, entity) => {
    let server = world.get_resource(res)
    let client_id = world.get(entity, ClientId)
    world.remove(entity, ClientId)
    Server.free_client_id(server, client_id)
  },
)

export let plugin = (app: App) => {
  app
    .add_resource(res, Server.make())
    .add_system(recv_messages, when(recv))
    .add_effect(identify_clients_effect)
}
