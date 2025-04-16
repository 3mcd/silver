import {System} from "#app/index"
import {make as query} from "#query_builder"
import {HasInterest, Interest} from "../../../interest.ts"
import * as Protocol from "../../../protocol.ts"
import {Remote} from "../../../remote.ts"

let remotes = query(Remote).read(HasInterest, interest =>
  interest.read(Interest),
)

export let send_interests: System = world => {
  world.for_each(remotes, (remote, interest) => {
    let message = Protocol.init_interest()
    Protocol.encode_interest(message, interest, world)
    remote.send(message.end())
  })
}
