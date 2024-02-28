export type OffsetSample = {
  client_time: number
  server_time: number
}

export type Config = {
  max_offset_deviation?: number
  min_sample_count?: number
  sample_outlier_rate?: number
}

class ClockSync {
  max_offset_deviation
  min_sample_count
  min_sample_count_with_extremes
  offset
  sample_outlier_rate
  samples
  samples_to_discard_per_extreme

  constructor(config?: Partial<Config>) {
    this.max_offset_deviation = config?.max_offset_deviation ?? 0.1
    this.min_sample_count = config?.min_sample_count ?? 8
    this.sample_outlier_rate = config?.sample_outlier_rate ?? 0.2
    this.samples_to_discard_per_extreme = Math.ceil(
      Math.max((this.min_sample_count * this.sample_outlier_rate) / 2, 1),
    )
    this.min_sample_count_with_extremes =
      this.min_sample_count + this.samples_to_discard_per_extreme * 2
    this.offset = 0
    this.samples = [] as number[]
  }
}
export type T = ClockSync

export let is_synced = (clock_sync: ClockSync): boolean => {
  return clock_sync.offset !== 0
}

let calc_offset = (clock_sync: ClockSync): number => {
  let samples = clock_sync.samples.slice().sort()
  let min_sample_index = clock_sync.samples_to_discard_per_extreme
  let max_sample_index =
    clock_sync.samples.length - clock_sync.samples_to_discard_per_extreme
  let offset = 0
  for (let i = min_sample_index; i < max_sample_index; i++) {
    offset += samples[i]
  }
  return offset / (max_sample_index - clock_sync.samples_to_discard_per_extreme)
}

/**
 * Add a client-server time offset sample to the ClockSync. Once the ClockSync
 * has enough samples it will estimate the difference between the client and
 * server times.
 *
 * Adding samples refreshes the client-server time offset only when the
 * difference between the current and next offset estimates surpasses the
 * ClockSync's configured maximum deviation.
 *
 * @param clock_sync
 * @param clock_sync_sample
 * @param client_time
 */
export let add_sample = (
  clock_sync: ClockSync,
  clock_sync_sample: OffsetSample,
  client_time: number,
): void => {
  let sample =
    clock_sync_sample.server_time -
    (clock_sync_sample.client_time + client_time) / 2
  if (
    clock_sync.samples.unshift(sample) ===
    clock_sync.min_sample_count_with_extremes
  ) {
    let offset = calc_offset(clock_sync)
    if (
      Math.abs(offset - clock_sync.offset) > clock_sync.max_offset_deviation
    ) {
      clock_sync.offset = offset
    }
    clock_sync.samples.pop()
  }
}

export let estimate_server_time = (
  clock_sync: ClockSync,
  client_time: number,
): number => {
  return client_time + clock_sync.offset
}

export let make = (config?: Partial<Config>): ClockSync => {
  return new ClockSync(config)
}
