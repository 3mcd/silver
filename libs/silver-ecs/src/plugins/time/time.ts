import {ref} from "../../component"

class Time {
  #t_monotonic
  #t_monotonic_prev

  constructor() {
    this.#t_monotonic = 0
    this.#t_monotonic_prev = 0
  }

  delta() {
    return this.#t_monotonic - this.#t_monotonic_prev
  }

  advance(t: number) {
    this.#t_monotonic_prev = this.#t_monotonic
    this.#t_monotonic = t
  }

  t_monotonic() {
    return this.#t_monotonic
  }
}

export type T = Time

export let make = () => {
  return new Time()
}

export let res = ref<Time>()

export let time = ref<number>()
