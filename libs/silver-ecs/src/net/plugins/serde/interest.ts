import * as Entity from "#entity"
import * as InterestQueue from "./interest_queue"

class Interest {
  #queue

  constructor() {
    this.#queue = InterestQueue.make()
  }

  amplify(entity: Entity.T, value: number) {
    let priority = this.#queue.priority_of(entity) ?? 0
    this.#queue.remove(entity)
    this.#queue.push(entity, priority + value)
  }
}
