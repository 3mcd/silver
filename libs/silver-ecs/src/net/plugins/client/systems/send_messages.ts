import {System} from "#app/index"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import {Time} from "#plugins/index"
import * as Selector from "#selector"
import {res} from "../client.ts"

let remotes = Selector.make().with(Remote)

export let send_messages: System = world => {
  let client = world.get_resource(res)
  let t_mono = world.get_resource(Time.res).t_mono()

  if (t_mono - client.t_last_time_sync > 0.2) {
    world.for_each(remotes, remote => {
      let message = Protocol.init_time_sync_request()
      Protocol.write_time_sync_request(message, t_mono)
      remote.send(message.end())
    })
    client.t_last_time_sync = t_mono
  }
}
