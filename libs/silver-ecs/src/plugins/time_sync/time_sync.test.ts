import {it as test, expect} from "vitest"
import {make} from "./time_sync.ts"

test("init", () => {
  let time_sync = make({
    outlier_rate: 0.2,
    max_offset: 1,
    min_offset_samples: 4,
  })
  let t0 = 1
  let t1 = 9
  while (!time_sync.is_synced()) {
    time_sync.add_sample([t0, t1], t0)
  }
  expect(time_sync.offset()).toBe(t1 - t0)
  return expect(time_sync.estimate_t_remote(t0)).toBe(t1)
})

test("desync tolerated", () => {
  let max_offset = 0.25
  let time_sync = make({
    max_offset,
    min_offset_samples: 5,
    outlier_rate: 0.2,
  })
  let offset = max_offset
  let t0 = 0.1
  let t1 = 0.5
  let n = 0
  while (!time_sync.is_synced()) {
    time_sync.add_sample([t0, t1], t0)
    n++
  }
  for (let i = 0; i < n; i++) {
    time_sync.add_sample([t0, t1 + offset], t0)
  }
  expect(time_sync.offset()).toBe(t1 - t0)
  return expect(time_sync.estimate_t_remote(t0)).toBe(t1)
})

test("desync untolerated", () => {
  let max_offset = 0.25
  let time_sync = make({
    max_offset,
    min_offset_samples: 5,
    outlier_rate: 0.2,
  })
  let offset = max_offset + Number.EPSILON
  let t0 = 1
  let t1 = 1.5
  let n = 0
  while (!time_sync.is_synced()) {
    time_sync.add_sample([t0, t1], t0)
    n++
  }
  for (let i = 0; i < n; i++) {
    time_sync.add_sample([t0, t1 + offset], t0)
  }
  expect(time_sync.offset()).toBeCloseTo(t1 - t0 + offset, 5)
  return expect(time_sync.estimate_t_remote(t0)).toBeCloseTo(t1 + offset, 5)
})

test("desync outliers", () => {
  let max_offset = 0.01
  let time_sync = make({
    max_offset,
    min_offset_samples: 10,
    outlier_rate: 0.5,
  })
  let offset = max_offset + Number.EPSILON
  let t0 = 1
  let t1 = 9
  let n = 0
  while (!time_sync.is_synced()) {
    time_sync.add_sample([t0, t1], t0)
    n++
  }
  for (let i = 0; i < n; i++) {
    time_sync.add_sample([t0, t1 + offset], t0)
  }
  expect(time_sync.offset()).toBeCloseTo(t1 - t0 + offset, 5)
  return expect(time_sync.estimate_t_remote(t0)).toBeCloseTo(t1 + offset, 5)
})

test("outliers", () => {
  let max_offset = 0.01
  let min_offset_samples = 10
  let time_sync = make({
    max_offset,
    min_offset_samples,
    outlier_rate: 0.5,
  })
  let offset = max_offset + Number.EPSILON
  let t0 = 1
  let t1 = 9
  while (!time_sync.is_synced()) {
    time_sync.add_sample([t0, t1], t0)
  }
  for (let i = 0; i < min_offset_samples; i++) {
    time_sync.add_sample([t0, t1 + offset], t0)
  }
  expect(time_sync.offset()).toBeCloseTo(t1 - t0, 5)
  return expect(time_sync.estimate_t_remote(t0)).toBeCloseTo(t1, 5)
})
