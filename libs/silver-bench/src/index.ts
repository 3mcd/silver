type PerfInit = () => () => void

export const $iterations = Symbol("iterations")

export class Perf {
  name
  init;
  [$iterations]?: number

  constructor(name: string, init: PerfInit, iterations?: number) {
    this.name = name
    this.init = init
    this[$iterations] = iterations
  }

  iterations(iterations: number) {
    this[$iterations] = iterations
    return this
  }
}

export let perfs = new Map<string, Perf>()

export let perf = (name: string, run: PerfInit) => {
  let perf = new Perf(name, run)
  perfs.set(name, perf)
  return perf
}
