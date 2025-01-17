import {Plugin, range, when} from "../../../app"
import * as Client from "./client"
import {recv_messages} from "./systems/recv_messages"
import {send_messages} from "./systems/send_messages"

export let recv = range()
export let send = range()

export let plugin: Plugin = app => {
  app
    .add_resource(Client.res, Client.make())
    .add_system(recv_messages, when(recv))
    .add_system(send_messages, when(send))
}
