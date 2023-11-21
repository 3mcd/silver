export type Config = {
  benchGlobals: Record<string, unknown>
  benchModuleExtension: string
  benchResultsExtension: string
  perfUnit: "s" | "ms" | "ns"
  perfSamplesToDiscardPerExtreme: number
  perfIterations: number
  perfSuccessThreshold: number
  perfWarningThreshold: number
  perfFailureThreshold: number
  writeFailures: boolean
}

export enum PerfResultStatus {
  New,
  Old,
  Success,
  Warning,
  Failure,
}

export type PerfResult = {
  name: string
  mean: number
}

export type PerfResultWithStatus = PerfResult & {
  status: PerfResultStatus
  margin: number
}

export type PerfResultWithDeviation = PerfResultWithStatus & {
  deviation: number
}

export type BenchResult = Record<
  string,
  PerfResultWithStatus | PerfResultWithDeviation
>

export type PerfWorkerData = {
  name: string
  path: string
  config: Config
}

export type BenchReadyMessage = {
  type: "bench-ready"
}

export type BenchConfigMessage = {
  type: "bench-config"
  config: Config
  path: string
}

export type BenchResultMessage = {
  type: "bench-result"
  result: BenchResult
}

export type BenchMessage =
  | BenchReadyMessage
  | BenchConfigMessage
  | BenchResultMessage
