import {System} from "#app/index"
import * as Buffer from "#buffer"
import {make as query} from "#query_builder"
import {HasInterest, Interest} from "../../../interest"
import * as Protocol from "../../../protocol"
import {Remote} from "../../../remote"

let remotes = query(Remote).with(HasInterest, interest =>
  interest.with(Interest),
)

export let send_interests: System = world => {
  world.for_each(remotes, (remote, interest) => {
    let message = Protocol.init_interest()
    Protocol.encode_interest(message, interest, world)
    remote.send(Buffer.end(message))
  })
}
