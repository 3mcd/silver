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

  advance() {
    this.#t_monotonic_prev = this.#t_monotonic
    this.#t_monotonic = performance.now() / 1_000
  }

  t_monotonic() {
    return this.#t_monotonic
  }
}

export let make = () => {
  return new Time()
}

export let res = ref<Time>()
