import {System} from "#app/index"
import * as Buffer from "#buffer"
import * as Protocol from "#net/protocol"
import {Remote} from "#net/remote"
import {Time} from "#plugins/index"
import * as QueryBuilder from "#query_builder"
import {res} from "../client"

let remotes = QueryBuilder.make().with(Remote)

export let send_messages: System = world => {
  let client = world.get_resource(res)
  let t_mono = world.get_resource(Time.res).t_mono()

  if (t_mono - client.t_time_sync > 0.2) {
    world.for_each(remotes, remote => {
      let request = Protocol.init_time_sync_request()
      Protocol.write_time_sync_request(request, t_mono)
      remote.send(Buffer.end(request))
    })
    client.t_time_sync = t_mono
  }
}
