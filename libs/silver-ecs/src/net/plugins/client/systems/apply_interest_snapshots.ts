import {System} from "#app/index"
import * as Protocol from "../../../protocol.ts"
import * as Client from "../client.ts"

export let apply_interest_snapshots: System = world => {
  let client = world.get_resource(Client.res)
  client.interest_snapshots.drain_all(snapshot => {
    Protocol.decode_interest(snapshot, world)
  })
}
