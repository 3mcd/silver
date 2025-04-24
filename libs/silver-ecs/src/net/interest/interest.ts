import {ref, rel, tag} from "#component"
import * as InterestQueue from "./interest_queue.ts"

import * as Entity from "#entity"
import * as SparseMap from "#sparse_map"
import * as SparseSet from "#sparse_set"

export interface Interest {
  amplify(entity: Entity.t, value: number): void
  discard(entity: Entity.t): void
  take(): Entity.t | undefined
  discarded_count(): number
  take_discarded(): Entity.t | undefined
}

export class InterestImpl implements Interest {
  #discarded
  #discarded_deficits
  #queue

  constructor() {
    this.#discarded = SparseSet.make<Entity.t>()
    this.#discarded_deficits = SparseMap.make<number>()
    this.#queue = InterestQueue.make()
  }

  amplify(entity: Entity.t, value: number) {
    if (this.#discarded.has(entity)) {
      return
    }

    let deficit = this.#discarded_deficits.get(entity)

    if (deficit !== undefined) {
      let deficit_remainder = deficit - value
      if (deficit_remainder > 0) {
        this.#discarded_deficits.set(entity, deficit_remainder)
        return
      }
      this.#discarded_deficits.delete(entity)
    }

    if (value <= Number.EPSILON) {
      this.discard(entity)
    } else {
      this.#queue.amplify(entity, value)
    }
  }

  discard(entity: Entity.t) {
    this.#queue.remove(entity)
    this.#discarded.add(entity)
    this.#discarded_deficits.set(entity, 1)
  }

  take() {
    return this.#queue.pop()
  }

  discarded_count() {
    return this.#discarded.size()
  }

  take_discarded() {
    let entity = this.#discarded.at(0)
    if (entity !== undefined) {
      this.#discarded.delete(entity)
    }
    return entity
  }
}

export type t = Interest

export let make = (): t => {
  return new InterestImpl()
}

export let Interest = ref<t>(make)
export let InterestedIn = rel({exclusive: true})
export let Forgotten = tag()
