#!/usr/bin/env node

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

const config = makeConfigFromEnv()
const spacer = " "

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

const colorPerfName = (perfResult: PerfResultWithStatus, perfName: string) => {
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

const colorPerfOpsPerSecond = (
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

const colorPerfMargin = (
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

const colorPerfDeviation = (
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

const ignoredDirs = new Set(["node_modules", ".git", ".github", ".vscode"])
const dir = path.dirname(url.fileURLToPath(import.meta.url))
const cwd = process.cwd()
const stack = [cwd]
const benches: string[] = []

let cursor = 1
while (cursor > 0) {
  const dir = stack[--cursor]
  const files = fs.readdirSync(dir)
  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir, files[i])
    const stat = fs.lstatSync(file)
    if (stat.isDirectory() && !ignoredDirs.has(files[i])) {
      stack[cursor++] = file
    } else if (file.endsWith(config.benchModuleExtension)) {
      benches.push(file)
    }
  }
}

const printBenchResult = (benchName: string, benchResult: BenchResult) => {
  const relativeBenchPath = benchName.replace(cwd, "")
  console.log("")
  console.log(relativeBenchPath.replace(/^(.*[\\\/])/, dim("$&")))
  let longestPerfNameLength = 0
  let longestPerfMarginLength = 0
  let longestPerfOpsPerSecondLength = 0
  const perfResultsOpsPerSecond: Record<string, string> = {}
  const perfResultsMargins: Record<string, string> = {}
  for (const perfName in benchResult) {
    const perfResult = benchResult[perfName]
    const perfOpsPerSecond = (perfResultsOpsPerSecond[perfName] =
      (1 / (perfResult.mean / perfUnitNs)).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      }) + ` ops/${config.perfUnit}`)
    const perfMargin = (perfResultsMargins[perfName] =
      "±" + perfResult.margin.toFixed(2) + "%")
    longestPerfNameLength = Math.max(longestPerfNameLength, perfName.length)
    longestPerfOpsPerSecondLength = Math.max(
      longestPerfOpsPerSecondLength,
      perfOpsPerSecond.length,
    )
    longestPerfMarginLength = Math.max(
      longestPerfMarginLength,
      perfMargin.length,
    )
  }
  for (const perfName in benchResult) {
    const perfResult = benchResult[perfName]
    const perfOpsPerSecond = perfResultsOpsPerSecond[perfName]
    const perfOpsPerSecondIndent = spacer.repeat(
      longestPerfNameLength - perfName.length + 2,
    )
    const perfMargin = perfResultsMargins[perfName]
    const perfMarginIndent = spacer.repeat(
      longestPerfOpsPerSecondLength - perfOpsPerSecond.length + 2,
    )
    let line =
      colorPerfName(perfResult, perfName) +
      perfOpsPerSecondIndent +
      colorPerfOpsPerSecond(perfResult, perfOpsPerSecond) +
      perfMarginIndent +
      colorPerfMargin(perfResult, perfMargin)
    if ("deviation" in perfResult) {
      const perfDeviationIndent = spacer.repeat(
        longestPerfMarginLength - perfMargin.length + 2,
      )
      const perfDeviation = colorPerfDeviation(
        perfResult,
        (perfResult.deviation * 100).toFixed(2) + "%",
      )
      line += perfDeviationIndent + perfDeviation
    }
    console.log(line)
  }
}

console.log("running benchmarks in", cwd)

const procs: ChildProcess[] = []
const kill = () => {
  console.log(`killing ${procs.length} benchmarks`)
  procs.forEach(proc => {
    process.kill(proc.pid!, "SIGTERM")
  })
}

for (let i = 0; i < benches.length; i++) {
  const benchPath = benches[i]
  const proc = fork(path.resolve(dir, "bench.js"), {
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
