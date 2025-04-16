import {Plugin, when} from "#app/index"
import * as Range from "#app/range"
import {Timesync} from "#plugins/index"
import * as Client from "./client.ts"
import {recv_messages} from "./systems/recv_messages.ts"
import {send_messages} from "./systems/send_messages.ts"

export let recv = Range.make(when(Timesync.collect))
export let send = Range.make()

export let plugin: Plugin = app => {
  app
    .add_resource(Client.res, Client.make())
    .add_system(recv_messages, when(recv))
    .add_system(send_messages, when(send))
}
