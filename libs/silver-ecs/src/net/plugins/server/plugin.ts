import {App, when} from "#app/index"
import * as Range from "#app/range"
import {ref} from "#component"
import * as Effect from "#effect"
import * as Entity from "#entity"
import * as World from "#world"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import * as Server from "./server.ts"
import {recv_messages} from "./systems/recv_messages.ts"
import {send_interests} from "./systems/send_interests.ts"

export let res = ref<Server.t>()
export let recv = Range.make()
export let send = Range.make()

let ClientId = ref<number>()

let identify_client = (world: World.t, entity: Entity.t) => {
  let server = world.get_resource(res)
  let client_remote = world.get(entity, Remote)
  let client_id = server.make_client_id()
  let buffer = Protocol.init_identity()
  world.add(entity, ClientId, client_id)
  Protocol.write_identity(buffer, client_id)
  client_remote.send(buffer.end())
}

let release_client = (world: World.t, entity: Entity.t) => {
  let server = world.get_resource(res)
  let client_id = world.get(entity, ClientId)
  world.remove(entity, ClientId)
  server.free_client_id(client_id)
}

let identify_clients = Effect.make([Remote], identify_client, release_client)

export let plugin = (app: App) => {
  app
    .add_resource(res, Server.make())
    .add_system(recv_messages, when(recv))
    .add_system(send_interests, when(send))
    .add_effect(identify_clients)
}
