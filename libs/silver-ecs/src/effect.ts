import * as Component from "./component"
import * as Entity from "./entity"
import * as Node from "./node"
import * as SparseSet from "./sparse_set"
import * as Transaction from "./transaction"
import * as Type from "./type"

type Event<U extends Component.T[]> = (
  // TODO: pass ref values
  // ...args: Parameters<Query.ForEachIteratee<U>>
  entity: Entity.T,
) => boolean

class Effect<U extends Component.T[]> implements Node.Listener {
  type
  on_match
  on_unmatch

  constructor(type: Type.T<U>, on_match: Event<U>, on_unmatch: Event<U>) {
    this.type = type
    this.on_match = on_match
    this.on_unmatch = on_unmatch
  }

  on_node_entities_in(batch: Transaction.Batch): void {
    SparseSet.each(batch.entities, entity => {
      this.on_match(entity)
    })
  }

  on_node_entities_out(batch: Transaction.Batch): void {
    SparseSet.each(batch.entities, entity => {
      this.on_unmatch(entity)
    })
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
