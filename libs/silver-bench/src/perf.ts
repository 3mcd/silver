import {hrtime} from "node:process"
import {parentPort, workerData} from "node:worker_threads"
import {$iterations, perfs} from "./index.js"
import {PerfWorkerData} from "./types.js"

const {name, path, config} = workerData as PerfWorkerData

Object.assign(globalThis, config.bench_globals)
await import(path)

const perf = perfs.get(name)!
const samples: bigint[] = []
const iterations = perf[$iterations] ?? config.perf_iterations
const iterations_bigint = BigInt(iterations)

for (let i = 0; i < iterations; i++) {
  perf.init()()
}

for (let i = 0; i < iterations; i++) {
  const run = perf.init()
  const start = hrtime.bigint()
  run()
  samples.push(hrtime.bigint() - start)
}

samples.sort((a, b) => (a === b ? 0 : a < b ? -1 : 1))

const final_iterations =
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

const stdev = Math.sqrt(Number(sum_stdev / final_iterations))
const margin = 1.96 * (stdev / Math.sqrt(Number(final_iterations)))

parentPort!.postMessage({
  name: perf.name,
  mean: Number(mean),
  margin: (margin / Number(mean)) * 100,
})
