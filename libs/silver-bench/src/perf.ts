import {hrtime} from "node:process"
import {parentPort, workerData} from "node:worker_threads"
import {$iterations, perfs} from "./index.js"
import {PerfWorkerData} from "./types.js"

let {name, path, config} = workerData as PerfWorkerData

Object.assign(globalThis, config.bench_globals)
await import(path)

let perf = perfs.get(name)!
let samples: bigint[] = []
let iterations = perf[$iterations] ?? config.perf_iterations
let iterations_bigint = BigInt(iterations)

for (let i = 0; i < iterations; i++) {
  perf.init()()
}

for (let i = 0; i < iterations; i++) {
  let run = perf.init()
  let start = hrtime.bigint()
  run()
  samples.push(hrtime.bigint() - start)
}

samples.sort((a, b) => (a === b ? 0 : a < b ? -1 : 1))

let final_iterations =
  iterations_bigint - BigInt(config.perf_samples_to_discard_per_extreme * 2)

let mean = 0n

for (
  let i = config.perf_samples_to_discard_per_extreme;
  i < samples.length - config.perf_samples_to_discard_per_extreme;
  i++
) {
  mean += samples[i]
}

mean /= final_iterations

let sum_stdev = 0n

for (
  let i = config.perf_samples_to_discard_per_extreme;
  i < samples.length - config.perf_samples_to_discard_per_extreme;
  i++
) {
  sum_stdev += (samples[i] - mean) ** 2n
}

let stdev = Math.sqrt(Number(sum_stdev / final_iterations))
let margin = 1.96 * (stdev / Math.sqrt(Number(final_iterations)))

parentPort!.postMessage({
  name: perf.name,
  mean: Number(mean),
  margin: (margin / Number(mean)) * 100,
})
