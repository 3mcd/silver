import {System} from "#app/index"
import {make as query} from "#selector"
import {Interest, InterestedIn} from "../../../interest/interest.ts"
import * as Protocol from "../../../protocol.ts"
import {Remote} from "../../../remote.ts"

let remotes = query(Remote).with(InterestedIn, interest =>
  interest.with(Interest),
)

export let send_interests: System = world => {
  world.for_each(remotes, (remote, interest) => {
    let message = Protocol.init_interest()
    Protocol.encode_interest(message, interest, world)
    remote.send(message.end())
  })
}
