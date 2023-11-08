import {Config} from "./types"

export let make_config = (config: Partial<Config>): Config => {
  return {
    bench_globals: config.bench_globals ?? {},
    bench_module_extension: config.bench_module_extension ?? "bench.ts",
    bench_results_extension:
      config.bench_results_extension ?? "bench-results.csv",
    perf_samples_to_discard_per_extreme:
      config.perf_samples_to_discard_per_extreme ?? 100,
    perf_unit: config.perf_unit ?? "s",
    perf_iterations: config.perf_iterations ?? 2000,
    perf_success_threshold: config.perf_success_threshold ?? 0.2,
    perf_warning_threshold: config.perf_warning_threshold ?? -0.2,
    perf_failure_threshold: config.perf_failure_threshold ?? -0.3,
    write_failures: config.write_failures ?? false,
  }
}

function assert_perf_unit_valid(
  metric: string,
): asserts metric is Config["perf_unit"] {
  if (metric !== "s" && metric !== "ms" && metric !== "ns") {
    throw new Error(`invalid perf metric: ${metric}`)
  }
}

export let makeConfigFromEnv = (): Config => {
  let env_perf_unit = process.env.PERF_UNIT
  if (env_perf_unit !== undefined) {
    assert_perf_unit_valid(env_perf_unit)
  }
  return make_config({
    bench_globals: process.env.BENCH_GLOBALS
      ? JSON.parse(process.env.BENCH_GLOBALS)
      : undefined,
    bench_module_extension: process.env.BENCH_MODULE_EXTENSION,
    bench_results_extension: process.env.BENCH_RESULTS_EXTENSION,
    perf_unit: env_perf_unit,
    perf_samples_to_discard_per_extreme: process.env
      .PERF_SAMPLES_TO_DISCARD_PER_EXTREME
      ? Number(process.env.PERF_SAMPLES_TO_DISCARD_PER_EXTREME)
      : undefined,
    perf_iterations: process.env.PERF_ITERATIONS
      ? Number(process.env.PERF_ITERATIONS)
      : undefined,
    perf_success_threshold: process.env.PERF_SUCCESS_THRESHOLD
      ? Number(process.env.PERF_SUCCESS_THRESHOLD)
      : undefined,
    perf_warning_threshold: process.env.PERF_WARNING_THRESHOLD
      ? Number(process.env.PERF_WARNING_THRESHOLD)
      : undefined,
    perf_failure_threshold: process.env.PERF_FAILURE_THRESHOLD
      ? Number(process.env.PERF_FAILURE_THRESHOLD)
      : undefined,
    write_failures:
      process.env.WRITE_FAILURES === "true"
        ? true
        : process.env.WRITE_FAILURES === "false"
        ? false
        : undefined,
  })
}
