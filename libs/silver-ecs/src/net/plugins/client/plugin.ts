import {Plugin} from "#app/index"
import * as Range from "#app/range"
import * as System from "#app/system"
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
  config = {...default_config, ...config}

  app
    .add_resource(Client.res, Client.make())
    .add_system(recv_messages, System.when(recv))
    .add_system(send_messages, System.when(send))

  if (config?.apply_interest_snapshots) {
    app.add_system(
      apply_interest_snapshots,
      System.when(recv),
      System.after(recv_messages),
    )
  }
}
