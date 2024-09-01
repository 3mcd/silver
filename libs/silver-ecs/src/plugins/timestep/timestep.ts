import {ref} from "../../component"
import * as Timestepper from "./timestepper"

export type Config = Timestepper.Config

export interface TControlled {
  t_control(): number
}

export interface T {
  advance(delta_t: number, t: number): void
  increment_step(): void
  step(): number
  steps(): number
  control(t_target: number): void
  is_controlled(): this is TControlled
  period(): number
}

class Timestep implements T {
  #step
  #steps
  #stepper
  #t_control: number | undefined

  constructor(config: Config) {
    this.#step = 0
    this.#steps = 0
    this.#stepper = Timestepper.make(config)
  }

  advance(delta_t: number, t: number) {
    this.#steps = this.#stepper.advance(delta_t, t)
  }

  increment_step() {
    this.#step++
  }

  step() {
    return this.#step
  }

  steps() {
    return this.#steps
  }

  control(t_target: number) {
    this.#t_control = t_target
  }

  t_control() {
    return this.#t_control
  }

  is_controlled(): this is TControlled {
    return this.#t_control !== undefined
  }

  period() {
    return this.#stepper.period()
  }
}

export let make = (config: Config): T => {
  return new Timestep(config)
}

export let res = ref<T>()
