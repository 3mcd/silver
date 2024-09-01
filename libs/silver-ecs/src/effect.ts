import * as Component from "./component"
import * as Entity from "./entity"
import * as Node from "./node"
import * as SparseSet from "./sparse_set"
import * as Transaction from "./transaction"
import * as World from "./world"

export type Term = Component.T | Component.PairFn

export type Event<U extends Term[]> = (world: World.T, entity: Entity.T) => void

class Effect<U extends Term[]> implements Node.Listener {
  terms
  on_match
  on_unmatch
  world: World.T | undefined

  constructor(terms: U, on_match?: Event<U>, on_unmatch?: Event<U>) {
    this.terms = terms
    this.on_match = on_match
    this.on_unmatch = on_unmatch
  }

  on_node_entities_in(batch: Transaction.Batch): void {
    SparseSet.each(batch.entities, entity => {
      this.on_match?.(this.world!, entity)
    })
  }

  on_node_entities_out(batch: Transaction.Batch): void {
    SparseSet.each(batch.entities, entity => {
      this.on_unmatch?.(this.world!, entity)
    })
  }
}

export type T<U extends Term[] = Term[]> = Effect<U>

export let make = <U extends Term[]>(
  terms: U,
  on_match?: Event<U>,
  on_unmatch?: Event<U>,
): T<U> => {
  return new Effect(terms, on_match, on_unmatch)
}
