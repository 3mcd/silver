import {System} from "#app/index"
import {make as query} from "#query_builder"
import {HasInterest, Interest} from "../../../interest"
import {Remote} from "../../../remote"

let remotes = query(Remote).with(HasInterest, interest =>
  interest.with(Interest),
)

export let send_interests: System = world => {
  world.for_each(remotes, (remote, interest) => {
    console.log(interest.pop())
  })
}
