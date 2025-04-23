import {ref, rel, tag} from "#component"
import * as InterestQueue from "./interest_queue.ts"

import * as Entity from "#entity"
import * as SparseMap from "#sparse_map"
import * as SparseSet from "#sparse_set"

export class InterestImpl {
  #debts
  #queue
  #to_discard

  constructor() {
    this.#debts = SparseMap.make<number>()
    this.#queue = InterestQueue.make()
    this.#to_discard = SparseSet.make<Entity.t>()
  }

  amplify(entity: Entity.t, value: number) {
    if (this.#to_discard.has(entity)) {
      return
    }

    let debt = this.#debts.get(entity)

    if (debt !== undefined && debt > 0) {
      let debt_remaining = debt - value
      if (debt_remaining <= 0) {
        this.#debts.delete(entity)
      } else {
        this.#debts.set(entity, debt_remaining)
        return
      }
    }

    if (value <= Number.EPSILON) {
      // remove the entity from the interest queue and set aside to be included in
      // the next interest message as a despawn
      this.#queue.remove(entity)
      this.#to_discard.add(entity)
      // reset entity debt to 1 to prevent rapid oscillations between discarded and
      // not discarded
      this.#debts.set(entity, 1)
      return
    }
    this.#queue.amplify(entity, value)
  }

  discard(entity: Entity.t) {
    this.amplify(entity, 0)
  }

  take() {
    return this.#queue.pop()
  }

  discarded_count() {
    return this.#to_discard.size()
  }

  take_discarded() {
    let entity = this.#to_discard.at(0)
    if (entity !== undefined) {
      this.#to_discard.delete(entity)
    }
    return entity
  }
}

export type t = InterestImpl

export let make = () => {
  return new InterestImpl()
}

export let Interest = ref(make)
export let HasInterest = rel({exclusive: true})
export let Forgotten = tag()
