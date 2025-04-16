import {ref} from "#component"

class Time {
  #t_mono
  #t_mono_prev

  constructor() {
    this.#t_mono = 0
    this.#t_mono_prev = 0
  }

  advance(t_mono: number) {
    this.#t_mono_prev = this.#t_mono
    this.#t_mono = t_mono
  }

  t_mono() {
    return this.#t_mono
  }

  t_delta() {
    return this.#t_mono - this.#t_mono_prev
  }
}

export type t = Time

export let make = () => {
  return new Time()
}

export let res = ref<Time>()

export let time = ref<number>()
