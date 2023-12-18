export enum TerminationCondition {
  /**
   * Configures a `FixedTimestep` to stop on or just before the target time.
   */
  LastUndershoot,
  /**
   * Configures a `FixedTimestep` to stop on or just after the target time.
   */
  FirstOvershoot,
}

export type FixedTimestepperConfig = {
  /**
   * Due to floating-point rounding errors, and the `maxUpdateDelta` limit, the
   * `FixedTimestep` might slowly drift away from the target time. `FixedTimestep`
   * compensates for small amounts of drift by calculating fewer or more steps than
   * usual. If the discepancy becomes too large, `FixedTimestep` will perform a
   * "time-skip" without publishing the corresponding steps. This option defines the
   * threshold for drift before a time-skip occurs.
   */
  maxDrift: number

  /**
   * The maximum time to step forward in a single call to `FixedTimestep#update`. This
   * option exists to avoid freezing the process when the `FixedTimestep`'s current time
   * drifts too far from the target time.
   */
  maxUpdateDelta: number

  /**
   * Decides whether to keep the current time slightly over or behind the target time.
   */
  terimationCondition: TerminationCondition

  /**
   * The number of seconds that should make up a single fixed step on any
   * machine.
   */
  timestep: number
}

let roundUpTo = (x: number, t: number) => Math.ceil(x / t) * t
let roundDownTo = (x: number, t: number) => Math.floor(x / t) * t

export class FixedTimestep {
  overshootTime
  skipTime
  tick
  time
  readonly maxDrift
  readonly maxUpdateDelta
  readonly terimationCondition
  readonly timestep

  constructor(config: FixedTimestepperConfig) {
    this.overshootTime = 0
    this.skipTime = 0
    this.tick = 0
    this.time = 0
    this.maxDrift = config.maxDrift
    this.maxUpdateDelta = config.maxUpdateDelta
    this.terimationCondition = config.terimationCondition
    this.timestep = config.timestep
  }
}
export type T = FixedTimestep

let shouldTerminate = (timestep: FixedTimestep, lastOvershootTime: number) => {
  switch (timestep.terimationCondition) {
    case TerminationCondition.LastUndershoot:
      return lastOvershootTime > 0
    case TerminationCondition.FirstOvershoot:
      return lastOvershootTime >= 0
  }
}

let compensateDeltaTime = (
  timestep: FixedTimestep,
  deltaTime: number,
  targetTime: number,
) => {
  let drift = measureDrift(timestep, targetTime - deltaTime)
  if (Math.abs(drift) - timestep.timestep * 0.5 < -Number.EPSILON) {
    drift = 0
  }
  let compensatedDeltaTimeUncapped = Math.max(deltaTime - drift, 0)
  let compensatedDeltaTime =
    compensatedDeltaTimeUncapped > timestep.maxUpdateDelta
      ? timestep.maxUpdateDelta
      : compensatedDeltaTimeUncapped
  return compensatedDeltaTime
}

let measureDrift = (timestep: FixedTimestep, targetTime: number) => {
  return timestep.time - timestep.overshootTime - targetTime
}

export let reset = (timestep: FixedTimestep, targetTime: number) => {
  let targetDecomposedTime = 0
  switch (timestep.terimationCondition) {
    case TerminationCondition.FirstOvershoot:
      targetDecomposedTime = roundUpTo(targetTime, timestep.timestep)
      break
    case TerminationCondition.LastUndershoot:
      targetDecomposedTime = roundDownTo(targetTime, timestep.timestep)
      break
  }
  timestep.time = targetDecomposedTime
  timestep.tick = targetDecomposedTime / timestep.timestep
  timestep.overshootTime = targetDecomposedTime - targetTime
}

let advanceInner = (timestep: FixedTimestep, deltaTime: number) => {
  let ticks = 0
  timestep.overshootTime -= deltaTime
  while (true) {
    let nextOvershootTime = timestep.overshootTime + timestep.timestep
    if (shouldTerminate(timestep, nextOvershootTime)) {
      break
    }
    timestep.overshootTime = nextOvershootTime
    timestep.time += timestep.timestep
    ticks++
  }
  timestep.tick += ticks
}

export let advance = (
  timestep: FixedTimestep,
  deltaTime: number,
  targetTime = timestep.time + deltaTime,
) => {
  let compensatedDeltaTime = compensateDeltaTime(
    timestep,
    deltaTime,
    targetTime,
  )
  advanceInner(timestep, compensatedDeltaTime)
  // Skip time if necessary.
  let drift = measureDrift(timestep, targetTime)
  if (Math.abs(drift) >= timestep.maxDrift) {
    reset(timestep, targetTime)
    timestep.skipTime = timestep.time
  }
}

export let make = (config: Partial<FixedTimestepperConfig> = {}) => {
  let maxDrift = config.maxDrift ?? 1
  let maxUpdateDelta = config.maxUpdateDelta ?? 0.1
  let terimationCondition =
    config.terimationCondition ?? TerminationCondition.FirstOvershoot
  let timeStep = config.timestep ?? 1 / 60
  return new FixedTimestep({
    maxDrift,
    maxUpdateDelta,
    terimationCondition,
    timestep: timeStep,
  })
}
