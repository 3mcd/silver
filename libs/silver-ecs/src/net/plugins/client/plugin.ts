import {Plugin, range, when} from "../../../app"
import {recv_messages} from "./systems/recv_messages"

export let recv = range()
export let send = range()

export let plugin: Plugin = app => {
  app.add_system(recv_messages, when(recv))
}
