import {Plugin} from "#app/index"
import * as Range from "#app/range"
import * as System from "#app/system"
import {debug, info} from "#logger"
import {Timesync} from "#plugins/index"
import * as Client from "./client.ts"
import {apply_interest_snapshots} from "./systems/apply_interest_snapshots.ts"
import {recv_messages} from "./systems/recv_messages.ts"
import {send_messages} from "./systems/send_messages.ts"

export let recv = Range.make(System.when(Timesync.collect))
export let send = Range.make()

type Config = {
  apply_interest_snapshots?: boolean
}

let default_config: Config = {
  apply_interest_snapshots: true,
}

export let plugin: Plugin<Config> = (app, config) => {
  let client_config = {...default_config, ...config}
  let client = Client.make()
  info("client", {event: "use", config: client_config})
  app
    .add_resource(Client.res, client)
    .add_system(recv_messages, System.when(recv))
    .add_system(send_messages, System.when(send))

  if (client_config.apply_interest_snapshots) {
    app.add_system(
      apply_interest_snapshots,
      System.when(recv),
      System.after(recv_messages),
    )
  }
}
