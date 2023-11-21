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

let dir = path.dirname(url.fileURLToPath(import.meta.url))
let currBenchResult: BenchResult = {}
let prevBenchResult: Record<string, PerfResult> = {}
let nextBenchResult: Record<string, PerfResultWithStatus> = {}

let perfResultCount = 0

let loadBenchResults = async (benchResultPath: string) => {
  let benchResultsStream = createReadStream(benchResultPath, {
    flags: "a+",
  })
  let benchPerfResults = createInterface({
    input: benchResultsStream,
    crlfDelay: Infinity,
  })
  for await (let perfResult of benchPerfResults) {
    let [perfName, perfAvg] = perfResult.split(",")
    prevBenchResult[perfName] = {name: perfName, mean: Number(perfAvg)}
  }
}

let reportBench = async (config: Config, benchPath: string) => {
  let benchResultPath = `${benchPath}.${config.benchResultsExtension}`
  await loadBenchResults(benchResultPath)
  let benchResultsFileContents = ""
  for (let perf_name of perfs.keys()) {
    let prev_perf_result = prevBenchResult[perf_name]
    let next_perf_result = nextBenchResult[perf_name]
    if (prev_perf_result !== undefined && next_perf_result !== undefined) {
      let delta = prev_perf_result.mean - next_perf_result.mean
      let deviation = delta / prev_perf_result.mean
      let status = PerfResultStatus.Old
      if (deviation <= config.perfFailureThreshold) {
        status = PerfResultStatus.Failure
        benchResultsFileContents += `${perf_name},${
          (config.writeFailures ? next_perf_result : prev_perf_result).mean
        }\n`
      } else if (deviation <= config.perfWarningThreshold) {
        status = PerfResultStatus.Warning
        benchResultsFileContents += `${perf_name},${
          (prev_perf_result.mean + next_perf_result.mean) / 2
        }\n`
      } else if (deviation >= config.perfSuccessThreshold) {
        status = PerfResultStatus.Success
        benchResultsFileContents += `${perf_name},${next_perf_result.mean}\n`
      } else {
        benchResultsFileContents += `${perf_name},${
          (prev_perf_result.mean + next_perf_result.mean) / 2
        }\n`
      }
      currBenchResult[perf_name] = {...next_perf_result, deviation, status}
    } else {
      currBenchResult[perf_name] = {
        ...next_perf_result,
        status: PerfResultStatus.New,
      }
      benchResultsFileContents += `${perf_name},${next_perf_result.mean}\n`
    }
  }
  await writeFile(benchResultPath, benchResultsFileContents)
  process.send!({type: "bench-result", result: currBenchResult})
}

let start = async (config: Config, benchPath: string) => {
  let workers: Worker[] = []
  let on_perf_result = (perf_result: PerfResultWithStatus) => {
    nextBenchResult[perf_result.name] = perf_result
    perfResultCount++
    if (perfResultCount === perfs.size) {
      reportBench(config, benchPath)
    }
  }
  Object.assign(globalThis, config.benchGlobals)
  await import(benchPath)
  for (let perf of perfs.values()) {
    let worker_data: PerfWorkerData = {
      path: benchPath,
      name: perf.name,
      config,
    }
    let worker = new Worker(path.join(dir, "perfWorker.js"), {
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
