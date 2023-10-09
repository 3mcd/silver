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
const benchResult: BenchResult = {}
const prevBenchResult: Record<string, PerfResult> = {}
const nextBenchResult: Record<string, PerfResultWithStatus> = {}

let perfResultCount = 0

const loadPrevBenchResults = async (benchResultPath: string) => {
  const benchResultsStream = createReadStream(benchResultPath, {
    flags: "a+",
  })
  const benchPerfResults = createInterface({
    input: benchResultsStream,
    crlfDelay: Infinity,
  })
  for await (const perfResult of benchPerfResults) {
    const [perfName, perfAvg] = perfResult.split(",")
    prevBenchResult[perfName] = {name: perfName, mean: Number(perfAvg)}
  }
}

const onBenchFinished = async (config: Config, benchPath: string) => {
  const benchResultPath = `${benchPath}.${config.benchResultsExtension}`
  await loadPrevBenchResults(benchResultPath)
  let benchResultFileContent = ""
  for (const perfName of perfs.keys()) {
    const prevPerfResult = prevBenchResult[perfName]
    const nextPerfResult = nextBenchResult[perfName]
    if (prevPerfResult !== undefined && nextPerfResult !== undefined) {
      const delta = prevPerfResult.mean - nextPerfResult.mean
      const deviation = delta / prevPerfResult.mean
      let status = PerfResultStatus.Old
      if (deviation <= config.perfFailureThreshold) {
        status = PerfResultStatus.Failure
        benchResultFileContent += `${perfName},${
          (config.writeFailures ? nextPerfResult : prevPerfResult).mean
        }\n`
      } else if (deviation <= config.perfWarningThreshold) {
        status = PerfResultStatus.Warning
        benchResultFileContent += `${perfName},${
          (prevPerfResult.mean + nextPerfResult.mean) / 2
        }\n`
      } else if (deviation >= config.perfSuccessThreshold) {
        status = PerfResultStatus.Success
        benchResultFileContent += `${perfName},${nextPerfResult.mean}\n`
      } else {
        benchResultFileContent += `${perfName},${
          (prevPerfResult.mean + nextPerfResult.mean) / 2
        }\n`
      }
      benchResult[perfName] = {...nextPerfResult, deviation, status}
    } else {
      benchResult[perfName] = {...nextPerfResult, status: PerfResultStatus.New}
      benchResultFileContent += `${perfName},${nextPerfResult.mean}\n`
    }
  }
  await writeFile(benchResultPath, benchResultFileContent)
  process.send!({type: "bench-result", result: benchResult})
}

const start = async (config: Config, benchPath: string) => {
  const workers: Worker[] = []
  const onPerfResult = (perfResult: PerfResultWithStatus) => {
    nextBenchResult[perfResult.name] = perfResult
    perfResultCount++
    if (perfResultCount === perfs.size) {
      onBenchFinished(config, benchPath)
    }
  }
  Object.assign(globalThis, config.benchGlobals)
  await import(benchPath)
  for (const perf of perfs.values()) {
    const workerData: PerfWorkerData = {
      path: benchPath,
      name: perf.name,
      config,
    }
    const worker = new Worker(path.join(dir, "perf_worker.js"), {workerData})
    worker.on("message", onPerfResult)
    workers.push(worker)
  }
}

process.on("message", (message: BenchMessage) => {
  if (message.type === "bench-config") {
    start(message.config, message.path)
  }
})

process.send!({type: "bench-ready"})
