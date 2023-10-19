export class ClockSync {
  lagCompensationLatency = 0.3
  maxOffsetDeviation = 0.1
  minOffsetSampleCount = 8
  minOffsetSampleCountWithOutliers = 0
  offset = 0
  offsetSampleOutlierRate = 0.2
  offsetSamples: number[] = []
  offsetSamplesToDiscardPerExtreme = 2

  constructor(
    maxOffsetDeviation?: number,
    minSampleCount?: number,
    offsetSampleOutlierRate?: number,
  ) {
    this.maxOffsetDeviation = maxOffsetDeviation ?? this.maxOffsetDeviation
    this.minOffsetSampleCount = minSampleCount ?? this.minOffsetSampleCount
    this.offsetSampleOutlierRate =
      offsetSampleOutlierRate ?? this.offsetSampleOutlierRate
    this.offsetSamplesToDiscardPerExtreme = Math.ceil(
      Math.max(
        (this.minOffsetSampleCount * this.offsetSampleOutlierRate) / 2,
        1,
      ),
    )
    this.minOffsetSampleCountWithOutliers =
      this.minOffsetSampleCount + this.offsetSamplesToDiscardPerExtreme * 2
  }
}

export const addOffsetSample = (
  clockSync: ClockSync,
  serverTime: number,
  clientTime: number,
  currentTime: number,
) => {
  const offsetSample = serverTime - (clientTime + currentTime) / 2
  if (
    clockSync.offsetSamples.unshift(offsetSample) ===
    clockSync.minOffsetSampleCountWithOutliers
  ) {
    const samples = clockSync.offsetSamples.slice().sort()
    const lo = clockSync.offsetSamplesToDiscardPerExtreme
    const hi =
      clockSync.offsetSamples.length -
      clockSync.offsetSamplesToDiscardPerExtreme
    let offset = 0
    for (let i = lo; i < hi; i++) {
      offset += samples[i]
    }
    offset = offset / (hi - clockSync.offsetSamplesToDiscardPerExtreme)
    if (Math.abs(offset - clockSync.offset) > clockSync.maxOffsetDeviation) {
      clockSync.offset = offset
    }
    clockSync.offsetSamples.pop()
  }
  return clockSync.offset
}

export const getEstimatedServerTime = (clockSync: ClockSync, time: number) => {
  return time + clockSync.offset + clockSync.lagCompensationLatency
}
