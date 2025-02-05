import {System} from "#app/index"
import {query} from "#index"
import {Topic, Interest} from "#net/plugins/serde/interest"
import {Remote} from "#net/remote"

let interested = query()
  .with(Remote)
  .with(Interest, interest => interest.with(Topic))

export let load_interest_snapshots: System = world => {
  world.for_each(interested, interest => {
    console.log(interest.pop())
  })
}
