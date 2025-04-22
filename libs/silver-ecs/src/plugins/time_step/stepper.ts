export type Config = {
  max_drift_t: number
  max_update_delta_t: number
  overshoot: boolean
  period: number
}

let round_up = (x: number, t: number) => Math.ceil(x / t) * t
let round_down = (x: number, t: number) => Math.floor(x / t) * t

class Timestepper {
  #config
  #t_quantized
  #t_overshoot

  constructor(config: Config) {
    this.#config = config
    this.#t_quantized = 0
    this.#t_overshoot = 0
  }

  #should_terminate(t_overshot: number) {
    if (this.#config.overshoot) {
      return this.#t_overshoot >= 0
    }
    return t_overshot > 0
  }

  #advance(t_delta: number) {
    let steps = 0
    this.#t_overshoot -= t_delta
    while (true) {
      let t_overshot = this.#t_overshoot + this.#config.period
      if (this.#should_terminate(t_overshot)) {
        break
      }
      this.#t_overshoot = t_overshot
      this.#t_quantized += this.#config.period
      steps++
    }
    return steps
  }

  #comp_delta_t(t_delta: number, t_target: number) {
    let drift = this.measure_drift(t_target - t_delta)
    if (Math.abs(drift) - this.#config.period * 0.5 < -Number.EPSILON) {
      drift = 0
    }
    let t_delta_comp_uncapped = Math.max(t_delta - drift, 0)
    let t_delta_comp =
      t_delta_comp_uncapped > this.#config.max_update_delta_t
        ? this.#config.max_update_delta_t
        : t_delta_comp_uncapped
    return t_delta_comp
  }

  measure_drift(t_target: number) {
    return this.#t_quantized - this.#t_overshoot - t_target
  }

  advance(t_delta: number, t_target: number) {
    let t_delta_comp = this.#comp_delta_t(t_delta, t_target)
    let steps = this.#advance(t_delta_comp)
    let t_drift = this.measure_drift(t_target)
    if (Math.abs(t_drift) >= this.#config.max_drift_t) {
      this.reset(t_target)
      console.log(
        `[time_step] reset due to drift: t_drift=${t_drift.toFixed(
          2,
        )}s, t_target=${t_target.toFixed(2)}s`,
      )
    }
    return steps
  }

  reset(t_target: number) {
    let t_target_decomp = 0
    if (this.#config.overshoot) {
      t_target_decomp = round_up(t_target, this.#config.period)
    } else {
      t_target_decomp = round_down(t_target, this.#config.period)
    }
    this.#t_quantized = t_target_decomp
    this.#t_overshoot = t_target_decomp - t_target
  }

  period() {
    return this.#config.period
  }

  t() {
    return this.#t_quantized
  }
}

export type t = Timestepper

export let make = (config: Config) => {
  return new Timestepper(config)
}
