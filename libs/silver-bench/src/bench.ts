import {createReadStream} from "node:fs"
import {writeFile} from "node:fs/promises"
import * as path from "node:path"
import {createInterface} from "node:readline"
import * as url from "node:url"
import {Worker} from "node:worker_threads"
import {perfs} from "./index"
import {
  BenchMessage,
  BenchResult,
  Config,
  PerfResult,
  PerfResultStatus,
  PerfResultWithStatus,
  PerfWorkerData,
} from "./types"

const dir = path.dirname(url.fileURLToPath(import.meta.url))
const curr_bench_result: BenchResult = {}
const prev_bench_result: Record<string, PerfResult> = {}
const next_bench_result: Record<string, PerfResultWithStatus> = {}

let perf_result_count = 0

const load_bench_results = async (bench_result_path: string) => {
  const bench_results_stream = createReadStream(bench_result_path, {
    flags: "a+",
  })
  const bench_perf_results = createInterface({
    input: bench_results_stream,
    crlfDelay: Infinity,
  })
  for await (const perf_result of bench_perf_results) {
    const [perf_name, perfAvg] = perf_result.split(",")
    prev_bench_result[perf_name] = {name: perf_name, mean: Number(perfAvg)}
  }
}

const report_bench = async (config: Config, benchPath: string) => {
  const bench_result_path = `${benchPath}.${config.bench_results_extension}`
  await load_bench_results(bench_result_path)
  let bench_results_file_contents = ""
  for (const perf_name of perfs.keys()) {
    const prev_perf_result = prev_bench_result[perf_name]
    const next_perf_result = next_bench_result[perf_name]
    if (prev_perf_result !== undefined && next_perf_result !== undefined) {
      const delta = prev_perf_result.mean - next_perf_result.mean
      const deviation = delta / prev_perf_result.mean
      let status = PerfResultStatus.Old
      if (deviation <= config.perf_failure_threshold) {
        status = PerfResultStatus.Failure
        bench_results_file_contents += `${perf_name},${
          (config.write_failures ? next_perf_result : prev_perf_result).mean
        }\n`
      } else if (deviation <= config.perf_warning_threshold) {
        status = PerfResultStatus.Warning
        bench_results_file_contents += `${perf_name},${
          (prev_perf_result.mean + next_perf_result.mean) / 2
        }\n`
      } else if (deviation >= config.perf_success_threshold) {
        status = PerfResultStatus.Success
        bench_results_file_contents += `${perf_name},${next_perf_result.mean}\n`
      } else {
        bench_results_file_contents += `${perf_name},${
          (prev_perf_result.mean + next_perf_result.mean) / 2
        }\n`
      }
      curr_bench_result[perf_name] = {...next_perf_result, deviation, status}
    } else {
      curr_bench_result[perf_name] = {
        ...next_perf_result,
        status: PerfResultStatus.New,
      }
      bench_results_file_contents += `${perf_name},${next_perf_result.mean}\n`
    }
  }
  await writeFile(bench_result_path, bench_results_file_contents)
  process.send!({type: "bench-result", result: curr_bench_result})
}

const start = async (config: Config, benchPath: string) => {
  const workers: Worker[] = []
  const on_perf_result = (perf_result: PerfResultWithStatus) => {
    next_bench_result[perf_result.name] = perf_result
    perf_result_count++
    if (perf_result_count === perfs.size) {
      report_bench(config, benchPath)
    }
  }
  Object.assign(globalThis, config.bench_globals)
  await import(benchPath)
  for (const perf of perfs.values()) {
    const worker_data: PerfWorkerData = {
      path: benchPath,
      name: perf.name,
      config,
    }
    const worker = new Worker(path.join(dir, "perf_worker.js"), {
      workerData: worker_data,
    })
    worker.on("message", on_perf_result)
    workers.push(worker)
  }
}

process.on("message", (message: BenchMessage) => {
  if (message.type === "bench-config") {
    start(message.config, message.path)
  }
})

process.send!({type: "bench-ready"})
