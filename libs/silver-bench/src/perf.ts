import {hrtime} from "node:process"
import {parentPort, workerData} from "node:worker_threads"
import {$iterations, perfs} from "./index.js"
import {PerfWorkerData} from "./types.js"

const {name, path, config} = workerData as PerfWorkerData

Object.assign(globalThis, config.benchGlobals)
await import(path)

const perf = perfs.get(name)!
const samples: bigint[] = []
const iterations = perf[$iterations] ?? config.perfIterations
const iterationsBigInt = BigInt(iterations)

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

const finalIterations =
  iterationsBigInt - BigInt(config.perfSamplesToDiscardPerExtreme * 2)

let mean = 0n

for (
  let i = config.perfSamplesToDiscardPerExtreme;
  i < samples.length - config.perfSamplesToDiscardPerExtreme;
  i++
) {
  mean += samples[i]
}

mean /= finalIterations

let sumStdev = 0n

for (
  let i = config.perfSamplesToDiscardPerExtreme;
  i < samples.length - config.perfSamplesToDiscardPerExtreme;
  i++
) {
  sumStdev += (samples[i] - mean) ** 2n
}

const stdev = Math.sqrt(Number(sumStdev / finalIterations))
const margin = 1.96 * (stdev / Math.sqrt(Number(finalIterations)))

parentPort!.postMessage({
  name: perf.name,
  mean: Number(mean),
  margin: (margin / Number(mean)) * 100,
})
