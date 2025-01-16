import {App, range, when} from "../../../app"
import {recv_messages} from "./systems/recv_messages"

export let recv = range()
export let send = range()

export let plugin = (app: App) => {
  app.add_system(recv_messages, when(recv))
}
