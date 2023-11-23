import {Color, dim, gray, green, red, yellow} from "colorette"
import {ChildProcess, fork} from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import * as url from "node:url"
import {makeConfigFromEnv} from "./config.js"
import {
  BenchMessage,
  BenchResult,
  PerfResultStatus,
  PerfResultWithStatus,
} from "./types.js"

let config = makeConfigFromEnv()
let spacer = " "

let perfUnitNs: number

switch (config.perfUnit) {
  case "s":
    perfUnitNs = 1e9
    break
  case "ms":
    perfUnitNs = 1e6
    break
  case "ns":
    perfUnitNs = 1
    break
}

let colorPerfName = (perfResult: PerfResultWithStatus, perfName: string) => {
  let color: Color
  switch (perfResult.status) {
    case PerfResultStatus.Failure:
      color = red
      break
    case PerfResultStatus.Warning:
      color = yellow
      break
    case PerfResultStatus.Success:
      color = green
      break
    default:
      color = gray
      break
  }
  return color(perfName)
}

let colorPerfsOpsPerS = (
  perfResult: PerfResultWithStatus,
  opsPerSecond: string,
) => {
  let color: Color
  switch (perfResult.status) {
    case PerfResultStatus.Failure:
      color = red
      break
    case PerfResultStatus.Warning:
      color = yellow
      break
    case PerfResultStatus.Success:
      color = green
      break
    default:
      color = dim
      break
  }
  return color(opsPerSecond)
}

let colorPerfMargin = (
  perfResult: PerfResultWithStatus,
  perfMargin: string,
) => {
  let color: Color
  switch (perfResult.status) {
    case PerfResultStatus.Failure:
      color = red
      break
    case PerfResultStatus.Warning:
      color = yellow
      break
    case PerfResultStatus.Success:
      color = green
      break
    default:
      color = dim
      break
  }
  return color(perfMargin)
}

let colorPerfDeviation = (
  perfResult: PerfResultWithStatus,
  perfDeviation: string,
) => {
  let color: Color
  switch (perfResult.status) {
    case PerfResultStatus.Success:
      color = green
      break
    case PerfResultStatus.Failure:
      color = red
      break
    case PerfResultStatus.Warning:
      color = yellow
      break
    default:
      color = dim
      break
  }
  return color(perfDeviation)
}

let ignoredDirs = new Set(["node_modules", ".git", ".github", ".vscode"])
let dir = path.dirname(url.fileURLToPath(import.meta.url))
let cwd = process.cwd()
let stack = [cwd]
let benches: string[] = []

let cursor = 1
while (cursor > 0) {
  let dir = stack[--cursor]
  let files = fs.readdirSync(dir)
  for (let i = 0; i < files.length; i++) {
    let file = path.join(dir, files[i])
    let stat = fs.lstatSync(file)
    if (stat.isDirectory() && !ignoredDirs.has(files[i])) {
      stack[cursor++] = file
    } else if (file.endsWith(config.benchModuleExtension)) {
      benches.push(file)
    }
  }
}

let printBenchResult = (benchName: string, benchResult: BenchResult) => {
  let relativeBenchPath = benchName.replace(cwd, "")
  console.log("")
  console.log(relativeBenchPath.replace(/^(.*[\\\/])/, dim("$&")))
  let maxPerfNameLength = 0
  let maxPerfMarginLength = 0
  let maxPerfOpsPerSLength = 0
  let perfResultsOpsPerS: Record<string, string> = {}
  let perfResultsMargins: Record<string, string> = {}
  for (let perfName in benchResult) {
    let perfResult = benchResult[perfName]
    let perfOpsPerS = (perfResultsOpsPerS[perfName] =
      (1 / (perfResult.mean / perfUnitNs)).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      }) + ` ops/${config.perfUnit}`)
    let perfMargin = (perfResultsMargins[perfName] =
      "±" + perfResult.margin.toFixed(2) + "%")
    maxPerfNameLength = Math.max(maxPerfNameLength, perfName.length)
    maxPerfOpsPerSLength = Math.max(maxPerfOpsPerSLength, perfOpsPerS.length)
    maxPerfMarginLength = Math.max(maxPerfMarginLength, perfMargin.length)
  }
  for (let perfName in benchResult) {
    let perfResult = benchResult[perfName]
    let perfOpsPerS = perfResultsOpsPerS[perfName]
    let perfOpsPerSIndent = spacer.repeat(
      maxPerfNameLength - perfName.length + 2,
    )
    let perfMargin = perfResultsMargins[perfName]
    let perfMarginIndent = spacer.repeat(
      maxPerfOpsPerSLength - perfOpsPerS.length + 2,
    )
    let line =
      colorPerfName(perfResult, perfName) +
      perfOpsPerSIndent +
      colorPerfsOpsPerS(perfResult, perfOpsPerS) +
      perfMarginIndent +
      colorPerfMargin(perfResult, perfMargin)
    if ("deviation" in perfResult) {
      let perfDeviationIndent = spacer.repeat(
        maxPerfMarginLength - perfMargin.length + 2,
      )
      let perfDeviation = colorPerfDeviation(
        perfResult,
        (perfResult.deviation * 100).toFixed(2) + "%",
      )
      line += perfDeviationIndent + perfDeviation
    }
    console.log(line)
  }
}

console.log("running benchmarks in", cwd)

let procs: ChildProcess[] = []
let kill = () => {
  console.log(`killing ${procs.length} benchmarks`)
  procs.forEach(proc => {
    process.kill(proc.pid!, "SIGTERM")
  })
}

for (let i = 0; i < benches.length; i++) {
  let benchPath = benches[i]
  let proc = fork(path.resolve(dir, "bench.js"), {
    execArgv: ["--loader", "tsx", "--no-warnings"],
  })
  proc.on("message", (message: BenchMessage) => {
    switch (message.type) {
      case "bench-ready":
        proc.send({type: "bench-config", config, path: benchPath})
        break
      case "bench-result":
        printBenchResult(benchPath, message.result as BenchResult)
        proc.kill()
        procs.splice(procs.indexOf(proc), 1)
        break
    }
  })
  proc.on("error", error => {
    console.log(`error in ${benches[i]}:`)
    console.error(error)
  })
  procs.push(proc)
}

process.on("SIGINT", kill)
process.on("SIGTERM", kill)
process.on("exit", () => {
  console.log("")
})
