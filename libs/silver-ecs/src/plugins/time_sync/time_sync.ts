import {ref} from "#component"

export type Sample = [t0: number, t1: number]

export type Config = {
  max_offset: number
  min_offset_samples: number
  outlier_rate: number
}

class TimeSync {
  #config
  #min_samples
  #offset = Infinity
  #samples = [] as number[]
  #samples_to_discard_per_extreme

  constructor(config: Config) {
    this.#config = config
    this.#samples_to_discard_per_extreme = Math.ceil(
      Math.max((config.min_offset_samples * config.outlier_rate) / 2, 1),
    )
    this.#min_samples =
      config.min_offset_samples + this.#samples_to_discard_per_extreme * 2
  }

  offset() {
    return this.#offset
  }

  is_synced() {
    return Number.isFinite(this.#offset)
  }

  add_sample(sample: Sample, t_current: number) {
    let offset = sample[1] - (sample[0] + t_current) / 2
    if (this.#samples.unshift(offset) === this.#min_samples) {
      let lo = this.#samples_to_discard_per_extreme
      let hi = this.#min_samples - lo
      let sorted = this.#samples.slice().sort()
      let mean = 0
      for (let i = lo; i < hi; i++) {
        mean += sorted[i]
      }
      mean /= hi - lo
      if (Math.abs(mean - this.#offset) > this.#config.max_offset) {
        this.#offset = mean
      }
      this.#samples.pop()
    }
  }

  estimate_t_remote(t_current: number) {
    return t_current + this.#offset
  }
}

export type T = TimeSync

export let make = (config: Config) => {
  return new TimeSync(config)
}

export let res = ref<T>()
