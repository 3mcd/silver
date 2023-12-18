import {
  CLOCK_SYNC_REQUEST_MESSAGE_TYPE,
  CLOCK_SYNC_RESPONSE_MESSAGE_TYPE,
} from "./protocol"

export type ResponsePayload = {
  clientTime: number
  serverTime: number
}

export type Config = {
  maxDeviation?: number
  minSampleCount?: number
  offsetSamplesOutlierRate?: number
}

class ClockSync {
  maxDeviation
  minSampleCount
  minSampleCountWithOutliers
  offset
  sampleOutlierRate
  samples
  samplesToDiscardPerExtreme

  constructor(config?: Partial<Config>) {
    this.maxDeviation = config?.maxDeviation ?? 0.1
    this.minSampleCount = config?.minSampleCount ?? 8
    this.sampleOutlierRate = config?.offsetSamplesOutlierRate ?? 0.2
    this.samplesToDiscardPerExtreme = Math.ceil(
      Math.max((this.minSampleCount * this.sampleOutlierRate) / 2, 1),
    )
    this.minSampleCountWithOutliers =
      this.minSampleCount + this.samplesToDiscardPerExtreme * 2
    this.offset = 0
    this.samples = [] as number[]
  }
}
export type T = ClockSync

export let isSynced = (clockSync: ClockSync) => {
  return clockSync.offset !== 0
}

export let addSample = (
  clockSync: ClockSync,
  clockSyncPayload: ResponsePayload,
  clientTime: number,
) => {
  let offsetSample =
    clockSyncPayload.serverTime - (clockSyncPayload.clientTime + clientTime) / 2
  if (
    clockSync.samples.unshift(offsetSample) ===
    clockSync.minSampleCountWithOutliers
  ) {
    let samples = clockSync.samples.slice().sort()
    let minSampleIndex = clockSync.samplesToDiscardPerExtreme
    let maxSampleIndex =
      clockSync.samples.length - clockSync.samplesToDiscardPerExtreme
    let offset = 0
    for (let i = minSampleIndex; i < maxSampleIndex; i++) {
      offset += samples[i]
    }
    offset = offset / (maxSampleIndex - clockSync.samplesToDiscardPerExtreme)
    if (Math.abs(offset - clockSync.offset) > clockSync.maxDeviation) {
      clockSync.offset = offset
    }
    clockSync.samples.pop()
    return true
  }
  return false
}

export let estimateServerTime = (clockSync: ClockSync, clientTime: number) => {
  return clientTime + clockSync.offset
}

export let make = (config?: Partial<Config>) => {
  return new ClockSync(config)
}

export let encodeRequest = (
  view: DataView,
  offset: number,
  clientTime: number,
) => {
  view.setUint8(offset, CLOCK_SYNC_REQUEST_MESSAGE_TYPE)
  offset += Uint8Array.BYTES_PER_ELEMENT
  view.setFloat64(offset, clientTime, true)
}

export let decodeRequest = (view: DataView, offset: number) => {
  offset += Uint8Array.BYTES_PER_ELEMENT
  return view.getFloat64(offset, true)
}

export let encodeResponse = (
  view: DataView,
  offset: number,
  clientTime: number,
  serverTime: number,
) => {
  view.setUint8(offset, CLOCK_SYNC_RESPONSE_MESSAGE_TYPE)
  offset += Uint8Array.BYTES_PER_ELEMENT
  view.setFloat64(offset, clientTime, true)
  offset += Float64Array.BYTES_PER_ELEMENT
  view.setFloat64(offset, serverTime, true)
}

export let decodeResponse = (
  view: DataView,
  offset: number,
  payload: ResponsePayload,
) => {
  offset += Uint8Array.BYTES_PER_ELEMENT
  payload.clientTime = view.getFloat64(offset, true)
  offset += Float64Array.BYTES_PER_ELEMENT
  payload.serverTime = view.getFloat64(offset, true)
}
