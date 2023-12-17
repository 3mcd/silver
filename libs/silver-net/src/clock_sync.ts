import {
  CLOCK_SYNC_REQUEST_MESSAGE_TYPE,
  CLOCK_SYNC_RESPONSE_MESSAGE_TYPE,
} from "./protocol"

export type ClockSyncResponsePayload = {
  clientTime: number
  serverTime: number
}

class ClockSync {
  maxOffsetDeviation = 0.1
  minOffsetSamplesCount = 8
  minOffsetSamplesCountWithOutliers = 0
  offset = 0
  sampleOutlierRate = 0.2
  samples: number[] = []
  samplesToDiscardPerExtreme = 2

  constructor(
    maxOffsetDeviation?: number,
    minOffsetSamplesCount?: number,
    offsetSamplesOutlierRate?: number,
  ) {
    this.maxOffsetDeviation = maxOffsetDeviation ?? this.maxOffsetDeviation
    this.minOffsetSamplesCount =
      minOffsetSamplesCount ?? this.minOffsetSamplesCount
    this.sampleOutlierRate = offsetSamplesOutlierRate ?? this.sampleOutlierRate
    this.samplesToDiscardPerExtreme = Math.ceil(
      Math.max((this.minOffsetSamplesCount * this.sampleOutlierRate) / 2, 1),
    )
    this.minOffsetSamplesCountWithOutliers =
      this.minOffsetSamplesCount + this.samplesToDiscardPerExtreme * 2
  }

  get isSynced() {
    return this.offset !== 0
  }
}
export type T = ClockSync

export let addSample = (
  clockSync: ClockSync,
  clockSyncPayload: ClockSyncResponsePayload,
  clientTime: number,
) => {
  let offsetSample =
    clockSyncPayload.serverTime - (clockSyncPayload.clientTime + clientTime) / 2
  if (
    clockSync.samples.unshift(offsetSample) ===
    clockSync.minOffsetSamplesCountWithOutliers
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
    if (Math.abs(offset - clockSync.offset) > clockSync.maxOffsetDeviation) {
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

export let make = (
  maxOffsetDeviation?: number,
  minOffsetSamplesCount?: number,
  offsetSamplesOutlierRate?: number,
) => {
  return new ClockSync(
    maxOffsetDeviation,
    minOffsetSamplesCount,
    offsetSamplesOutlierRate,
  )
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
  payload: ClockSyncResponsePayload,
) => {
  offset += Uint8Array.BYTES_PER_ELEMENT
  payload.clientTime = view.getFloat64(offset, true)
  offset += Float64Array.BYTES_PER_ELEMENT
  payload.serverTime = view.getFloat64(offset, true)
}
