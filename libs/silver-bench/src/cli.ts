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

let perf_unit_ns: number

switch (config.perf_unit) {
  case "s":
    perf_unit_ns = 1e9
    break
  case "ms":
    perf_unit_ns = 1e6
    break
  case "ns":
    perf_unit_ns = 1
    break
}

let color_perf_name = (
  perf_result: PerfResultWithStatus,
  perf_name: string,
) => {
  let color: Color
  switch (perf_result.status) {
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
  return color(perf_name)
}

let color_perfs_ops_per_s = (
  perf_result: PerfResultWithStatus,
  opsPerSecond: string,
) => {
  let color: Color
  switch (perf_result.status) {
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

let color_perf_margin = (
  perf_result: PerfResultWithStatus,
  perf_margin: string,
) => {
  let color: Color
  switch (perf_result.status) {
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
  return color(perf_margin)
}

let color_perf_deviation = (
  perf_result: PerfResultWithStatus,
  perf_deviation: string,
) => {
  let color: Color
  switch (perf_result.status) {
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
  return color(perf_deviation)
}

let ignored_dirs = new Set(["node_modules", ".git", ".github", ".vscode"])
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
    if (stat.isDirectory() && !ignored_dirs.has(files[i])) {
      stack[cursor++] = file
    } else if (file.endsWith(config.bench_module_extension)) {
      benches.push(file)
    }
  }
}

let print_bench_result = (bench_name: string, bench_result: BenchResult) => {
  let relative_bench_path = bench_name.replace(cwd, "")
  console.log("")
  console.log(relative_bench_path.replace(/^(.*[\\\/])/, dim("$&")))
  let max_perf_name_length = 0
  let max_perf_margin_length = 0
  let max_perf_ops_per_s_length = 0
  let perf_results_ops_per_s: Record<string, string> = {}
  let perf_results_margins: Record<string, string> = {}
  for (let perf_name in bench_result) {
    let perf_result = bench_result[perf_name]
    let perf_ops_per_s = (perf_results_ops_per_s[perf_name] =
      (1 / (perf_result.mean / perf_unit_ns)).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      }) + ` ops/${config.perf_unit}`)
    let perf_margin = (perf_results_margins[perf_name] =
      "±" + perf_result.margin.toFixed(2) + "%")
    max_perf_name_length = Math.max(max_perf_name_length, perf_name.length)
    max_perf_ops_per_s_length = Math.max(
      max_perf_ops_per_s_length,
      perf_ops_per_s.length,
    )
    max_perf_margin_length = Math.max(
      max_perf_margin_length,
      perf_margin.length,
    )
  }
  for (let perf_name in bench_result) {
    let perf_result = bench_result[perf_name]
    let perf_ops_per_s = perf_results_ops_per_s[perf_name]
    let perf_ops_per_s_indent = spacer.repeat(
      max_perf_name_length - perf_name.length + 2,
    )
    let perf_margin = perf_results_margins[perf_name]
    let perf_margin_indent = spacer.repeat(
      max_perf_ops_per_s_length - perf_ops_per_s.length + 2,
    )
    let line =
      color_perf_name(perf_result, perf_name) +
      perf_ops_per_s_indent +
      color_perfs_ops_per_s(perf_result, perf_ops_per_s) +
      perf_margin_indent +
      color_perf_margin(perf_result, perf_margin)
    if ("deviation" in perf_result) {
      let perf_deviation_indent = spacer.repeat(
        max_perf_margin_length - perf_margin.length + 2,
      )
      let perf_deviation = color_perf_deviation(
        perf_result,
        (perf_result.deviation * 100).toFixed(2) + "%",
      )
      line += perf_deviation_indent + perf_deviation
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
  let bench_path = benches[i]
  let proc = fork(path.resolve(dir, "bench.js"), {
    execArgv: ["--loader", "tsx", "--no-warnings"],
  })
  proc.on("message", (message: BenchMessage) => {
    switch (message.type) {
      case "bench-ready":
        proc.send({type: "bench-config", config, path: bench_path})
        break
      case "bench-result":
        print_bench_result(bench_path, message.result as BenchResult)
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
