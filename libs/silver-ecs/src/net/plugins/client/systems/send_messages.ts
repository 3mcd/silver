import {System} from "../../../../app"
import {Time} from "../../../../plugins"
import * as QueryBuilder from "../../../../query_builder"
import {Remote} from "../../../remote"
import {Transport} from "../../../transport"
import * as Buffer from "../../../../buffer"
import * as Protocol from "../../../protocol"
import {res} from "../client"

let remotes = QueryBuilder.make().with(Remote).with(Transport)

export let send_messages: System = world => {
  let client = world.get_resource(res)
  let t_mono = world.get_resource(Time.res).t_mono()

  if (t_mono - client.t_time_sync > 0.2) {
    world.for_each(remotes, transport => {
      let request = Protocol.init_time_sync_request()
      Protocol.write_time_sync_request(request, t_mono)
      transport.send(Buffer.end(request))
    })
    client.t_time_sync = t_mono
  }
}
