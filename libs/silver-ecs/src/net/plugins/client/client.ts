import * as Buffer from "#buffer"
import * as Component from "#component"
import * as StepBuffer from "#step_buffer"

class Client {
  interest_snapshots
  t_last_time_sync = 0

  constructor() {
    this.interest_snapshots = StepBuffer.make<Buffer.t>()
  }

  add_snapshot(buffer: Buffer.t, step: number) {
    this.interest_snapshots.insert(step, buffer)
  }
}

export type t = Client

export let make = () => new Client()

export let res = Component.ref<Client>()
