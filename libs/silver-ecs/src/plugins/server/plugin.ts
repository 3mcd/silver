import * as Effect from "../../effect"
import {App, range, when} from "../../app"
import {Client} from "./components"
import * as Server from "./server"
import {recv_client_messages} from "./systems/recv_client_messages"

export let recv = range()
export let send = range()

let init_client_effect = Effect.make([Client], () => {})

export let plugin = (app: App) => {
  app
    .add_system(recv_client_messages, when(recv))
    .add_effect(init_client_effect)
}
