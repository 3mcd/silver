export class ClockSync {
  lag_compensation_latency = 0.3
  max_offset_deviation = 0.1
  min_offset_samples_count = 8
  min_offset_samples_count_with_outliers = 0
  offset = 0
  offset_samples_outlier_rate = 0.2
  offset_samples_to_discard_per_extreme = 2
  offset_samples: number[] = []

  constructor(
    max_offset_deviation?: number,
    min_offset_samples_count?: number,
    offset_samples_outlier_rate?: number,
  ) {
    this.max_offset_deviation =
      max_offset_deviation ?? this.max_offset_deviation
    this.min_offset_samples_count =
      min_offset_samples_count ?? this.min_offset_samples_count
    this.offset_samples_outlier_rate =
      offset_samples_outlier_rate ?? this.offset_samples_outlier_rate
    this.offset_samples_to_discard_per_extreme = Math.ceil(
      Math.max(
        (this.min_offset_samples_count * this.offset_samples_outlier_rate) / 2,
        1,
      ),
    )
    this.min_offset_samples_count_with_outliers =
      this.min_offset_samples_count +
      this.offset_samples_to_discard_per_extreme * 2
  }
}

export let add_offset_sample = (
  clock_sync: ClockSync,
  payload_server_time: number,
  payload_client_time: number,
  current_client_time: number,
) => {
  let offset_sample =
    payload_server_time - (payload_client_time + current_client_time) / 2
  if (
    clock_sync.offset_samples.unshift(offset_sample) ===
    clock_sync.min_offset_samples_count_with_outliers
  ) {
    let samples = clock_sync.offset_samples.slice().sort()
    let min_sample_index = clock_sync.offset_samples_to_discard_per_extreme
    let max_sample_index =
      clock_sync.offset_samples.length -
      clock_sync.offset_samples_to_discard_per_extreme
    let offset = 0
    for (let i = min_sample_index; i < max_sample_index; i++) {
      offset += samples[i]
    }
    offset =
      offset /
      (max_sample_index - clock_sync.offset_samples_to_discard_per_extreme)
    if (
      Math.abs(offset - clock_sync.offset) > clock_sync.max_offset_deviation
    ) {
      clock_sync.offset = offset
    }
    clock_sync.offset_samples.pop()
    return true
  }
  return false
}

export let estimate_server_time = (clock_sync: ClockSync, time: number) => {
  return time + clock_sync.offset + clock_sync.lag_compensation_latency
}

if (import.meta.vitest) {
  let {describe, it, expect} = await import("vitest")

  describe("ClockSync", () => {
    it.todo("should work")
  })
}
