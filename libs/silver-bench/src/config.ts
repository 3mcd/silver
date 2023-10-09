import {Config} from "./types"

export const makeConfig = (config: Partial<Config>): Config => {
  return {
    benchGlobals: config.benchGlobals ?? {},
    benchModuleExtension: config.benchModuleExtension ?? "bench.ts",
    benchResultsExtension: config.benchResultsExtension ?? "bench-results.csv",
    perfSamplesToDiscardPerExtreme:
      config.perfSamplesToDiscardPerExtreme ?? 100,
    perfUnit: config.perfUnit ?? "s",
    perfIterations: config.perfIterations ?? 2000,
    perfSuccessThreshold: config.perfSuccessThreshold ?? 0.2,
    perfWarningThreshold: config.perfWarningThreshold ?? -0.2,
    perfFailureThreshold: config.perfFailureThreshold ?? -0.3,
    writeFailures: config.writeFailures ?? false,
  }
}

function assertPerfMetricValid(
  metric: string,
): asserts metric is Config["perfUnit"] {
  if (metric !== "s" && metric !== "ms" && metric !== "ns") {
    throw new Error(`invalid perf metric: ${metric}`)
  }
}

export const makeConfigFromEnv = (): Config => {
  const envPerfMetric = process.env.PERF_UNIT
  if (envPerfMetric !== undefined) {
    assertPerfMetricValid(envPerfMetric)
  }
  return makeConfig({
    benchGlobals: process.env.BENCH_GLOBALS
      ? JSON.parse(process.env.BENCH_GLOBALS)
      : undefined,
    benchModuleExtension: process.env.BENCH_MODULE_EXTENSION,
    benchResultsExtension: process.env.BENCH_RESULTS_EXTENSION,
    perfUnit: envPerfMetric,
    perfSamplesToDiscardPerExtreme: process.env
      .PERF_SAMPLES_TO_DISCARD_PER_EXTREME
      ? Number(process.env.PERF_SAMPLES_TO_DISCARD_PER_EXTREME)
      : undefined,
    perfIterations: process.env.PERF_ITERATIONS
      ? Number(process.env.PERF_ITERATIONS)
      : undefined,
    perfSuccessThreshold: process.env.PERF_SUCCESS_THRESHOLD
      ? Number(process.env.PERF_SUCCESS_THRESHOLD)
      : undefined,
    perfWarningThreshold: process.env.PERF_WARNING_THRESHOLD
      ? Number(process.env.PERF_WARNING_THRESHOLD)
      : undefined,
    perfFailureThreshold: process.env.PERF_FAILURE_THRESHOLD
      ? Number(process.env.PERF_FAILURE_THRESHOLD)
      : undefined,
    writeFailures:
      process.env.WRITE_FAILURES === "true"
        ? true
        : process.env.WRITE_FAILURES === "false"
        ? false
        : undefined,
  })
}
