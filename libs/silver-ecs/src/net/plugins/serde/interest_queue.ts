import {assert_exists} from "#assert"
import * as Entity from "#entity"

let left = (index: number) => 2 * index + 1
let right = (index: number) => 2 * index + 2
let parent = (index: number) => Math.ceil(index / 2) - 1

class InterestQueue {
  #heap
  #entity_indices
  #entity_priorities

  constructor() {
    this.#heap = [] as Entity.T[]
    this.#entity_indices = [] as number[]
    this.#entity_priorities = [] as number[]
  }

  #priority_of(index: number) {
    return this.#entity_priorities[this.#heap[index]]
  }

  #remove(index: number) {
    if (this.#heap.length === 0) {
      return null
    }
    this.#swap(index, this.#heap.length - 1)
    let entity = assert_exists(this.#heap.pop())
    this.#entity_indices[entity] = undefined!
    this.#entity_priorities[entity] = undefined!
    this.#down(index)
    return entity
  }

  #swap(i1: number, i2: number) {
    let v1 = this.#heap[i1]
    let v2 = this.#heap[i2]
    this.#entity_indices[v1] = i2
    this.#entity_indices[v2] = i1
    this.#heap[i1] = this.#heap[i2]
    this.#heap[i2] = v1
  }

  #top(index: number) {
    return right(index) < this.#heap.length &&
      this.#priority_of(right(index)) - this.#priority_of(left(index)) > 0
      ? right(index)
      : left(index)
  }

  #up() {
    let index = this.#heap.length - 1

    while (
      parent(index) >= 0 &&
      this.#priority_of(index) - this.#priority_of(parent(index)) > 0
    ) {
      this.#swap(parent(index), index)
      index = parent(index)
    }
  }

  #down(index: number) {
    let curr = index
    while (
      left(curr) < this.#heap.length &&
      this.#priority_of(this.#top(curr)) - this.#priority_of(curr) > 0
    ) {
      let next = this.#top(curr)
      this.#swap(curr, next)
      curr = next
    }
  }

  length() {
    return this.#heap.length
  }

  priority_of(entity: Entity.T) {
    return this.#entity_priorities[entity]
  }

  has(entity: Entity.T) {
    return assert_exists(this.#entity_priorities[entity])
  }

  push(entity: Entity.T, priority_of: number) {
    if (this.#entity_indices[entity] >= 0) {
      this.remove(entity)
    }
    this.#entity_priorities[entity] = priority_of
    this.#entity_indices[entity] = this.#heap.push(entity) - 1
    this.#up()
  }

  peek() {
    return this.#heap[0]
  }

  remove(entity: Entity.T) {
    if (!this.has(entity)) {
      return
    }
    this.#remove(this.#entity_indices[entity])
  }

  pop() {
    return this.#remove(0)
  }

  is_empty() {
    return this.#heap.length === 0
  }
}

export type T = InterestQueue

export let make = () => new InterestQueue()
