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

export const perfs = new Map<string, Perf>()

export const perf = (name: string, run: PerfInit) => {
  const perf = new Perf(name, run)
  perfs.set(name, perf)
  return perf
}
