export class ClockSync {
  lagCompensationLatency = 0.3
  maxOffsetDeviation = 0.1
  minOffsetSamplesCount = 8
  minOffsetSamplesCountWithOutliers = 0
  offset = 0
  offsetSamplesOutlierRate = 0.2
  offsetSamplesToDiscardPerExtreme = 2
  offsetSamples: number[] = []

  constructor(
    maxOffsetDeviation?: number,
    minOffsetSamplesCount?: number,
    offsetSamplesOutlierRate?: number,
  ) {
    this.maxOffsetDeviation =
      maxOffsetDeviation ?? this.maxOffsetDeviation
    this.minOffsetSamplesCount =
      minOffsetSamplesCount ?? this.minOffsetSamplesCount
    this.offsetSamplesOutlierRate =
      offsetSamplesOutlierRate ?? this.offsetSamplesOutlierRate
    this.offsetSamplesToDiscardPerExtreme = Math.ceil(
      Math.max(
        (this.minOffsetSamplesCount * this.offsetSamplesOutlierRate) / 2,
        1,
      ),
    )
    this.minOffsetSamplesCountWithOutliers =
      this.minOffsetSamplesCount +
      this.offsetSamplesToDiscardPerExtreme * 2
  }
}

export let addOffsetSample = (
  clockSync: ClockSync,
  payloadServerTime: number,
  payloadClientTime: number,
  currentClientTime: number,
) => {
  let offsetSample =
    payloadServerTime - (payloadClientTime + currentClientTime) / 2
  if (
    clockSync.offsetSamples.unshift(offsetSample) ===
    clockSync.minOffsetSamplesCountWithOutliers
  ) {
    let samples = clockSync.offsetSamples.slice().sort()
    let minSampleIndex = clockSync.offsetSamplesToDiscardPerExtreme
    let maxSampleIndex =
      clockSync.offsetSamples.length -
      clockSync.offsetSamplesToDiscardPerExtreme
    let offset = 0
    for (let i = minSampleIndex; i < maxSampleIndex; i++) {
      offset += samples[i]
    }
    offset =
      offset /
      (maxSampleIndex - clockSync.offsetSamplesToDiscardPerExtreme)
    if (
      Math.abs(offset - clockSync.offset) > clockSync.maxOffsetDeviation
    ) {
      clockSync.offset = offset
    }
    clockSync.offsetSamples.pop()
    return true
  }
  return false
}

export let estimateServerTime = (clockSync: ClockSync, time: number) => {
  return time + clockSync.offset + clockSync.lagCompensationLatency
}
