import {assert} from "#assert"
import * as Component from "./component.ts"
import * as Entity from "./entity.ts"
import * as Node from "./node.ts"
import * as Transaction from "./stage.ts"
import * as World from "./world.ts"

export type Term = Component.t | Component.PairFn
export type Event<U extends Term[]> = (world: World.t, entity: Entity.t) => void

export class Effect<U extends Term[]> implements Node.Listener {
  #on_match
  #on_unmatch
  /** @internal */
  terms
  /** @internal */
  world: World.t | undefined

  constructor(terms: U, on_match?: Event<U>, on_unmatch?: Event<U>) {
    this.terms = terms
    this.#on_match = on_match
    this.#on_unmatch = on_unmatch
  }

  /** @internal */
  on_node_entities_in(batch: Transaction.Batch): void {
    if (this.#on_match === undefined) {
      return
    }
    assert(this.world !== undefined)
    batch.entities.each(entity => {
      this.#on_match!(this.world!, entity)
    })
  }

  /** @internal */
  on_node_entities_out(batch: Transaction.Batch): void {
    if (this.#on_unmatch === undefined) {
      return
    }
    assert(this.world !== undefined)
    batch.entities.each(entity => {
      this.#on_unmatch!(this.world!, entity)
    })
  }
}

export type t<U extends Term[] = Term[]> = Effect<U>

export let make = <U extends Term[]>(
  terms: U,
  on_match?: Event<U>,
  on_unmatch?: Event<U>,
): t<U> => {
  return new Effect(terms, on_match, on_unmatch)
}
