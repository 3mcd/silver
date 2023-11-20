export type Config = {
    bench_globals: Record<string, unknown>;
    bench_module_extension: string;
    bench_results_extension: string;
    perf_unit: "s" | "ms" | "ns";
    perf_samples_to_discard_per_extreme: number;
    perf_iterations: number;
    perf_success_threshold: number;
    perf_warning_threshold: number;
    perf_failure_threshold: number;
    write_failures: boolean;
};
export declare enum PerfResultStatus {
    New = 0,
    Old = 1,
    Success = 2,
    Warning = 3,
    Failure = 4
}
export type PerfResult = {
    name: string;
    mean: number;
};
export type PerfResultWithStatus = PerfResult & {
    status: PerfResultStatus;
    margin: number;
};
export type PerfResultWithDeviation = PerfResultWithStatus & {
    deviation: number;
};
export type BenchResult = Record<string, PerfResultWithStatus | PerfResultWithDeviation>;
export type PerfWorkerData = {
    name: string;
    path: string;
    config: Config;
};
export type BenchReadyMessage = {
    type: "bench-ready";
};
export type BenchConfigMessage = {
    type: "bench-config";
    config: Config;
    path: string;
};
export type BenchResultMessage = {
    type: "bench-result";
    result: BenchResult;
};
export type BenchMessage = BenchReadyMessage | BenchConfigMessage | BenchResultMessage;
