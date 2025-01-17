import {App, range, when} from "#app/index"
import * as Buffer from "#buffer"
import {ref} from "#component"
import * as Effect from "#effect"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import {Transport} from "#net/transport"
import * as Server from "./server"
import {recv_messages} from "./systems/recv_messages"

export let res = ref<Server.T>()
export let recv = range()
export let send = range()

let ClientId = ref<number>()

let identify_clients = Effect.make(
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
    .add_effect(identify_clients)
}
