import * as Component from "../data/component"
import * as Query from "../query/query"
import * as Node from "./node"
import * as Transaction from "./transaction"
import * as Type from "../data/type"

type Event<U extends Component.T[]> = (...args: Query.EachArgs<U>) => boolean

class Effect<U extends Component.T[]> implements Node.Listener {
  type
  on_match
  on_unmatch

  constructor(type: Type.T<U>, on_match: Event<U>, on_unmatch: Event<U>) {
    this.type = type
    this.on_match = on_match
    this.on_unmatch = on_unmatch
  }

  on_entities_in(batch: Transaction.Batch): void {
    for (let i = 0; i < batch.entities.length; i++) {
      const entity = batch.entities[i]
      this.on_match(entity)
    }
  }

  on_entities_out(batch: Transaction.Batch): void {
    for (let i = 0; i < batch.entities.length; i++) {
      const entity = batch.entities[i]
      this.on_unmatch(entity)
    }
  }
}

export type T<U extends Component.T[] = Component.T[]> = Effect<U>

export let make = <U extends Component.T[]>(
  type: Type.T<U>,
  on_match: Event<U>,
  on_unmatch: Event<U>,
): T<U> => {
  return new Effect(type, on_match, on_unmatch)
}
