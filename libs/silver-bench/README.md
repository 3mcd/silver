# silver-bench

A fast and configurable benchmarking tool for JS/TS.

## Usage

In your project, run:

```sh
npm i silver-bench
```

Then create a file named `vec2.bench.ts` that looks like this:

```ts
import {perf} from "silver-bench"

perf("add", () => {
  // setup
  let a = {x: 0, y: 0}
  let b = {x: 1, y: 2}
  // run
  return () => {
    a.x += b.x
    a.y += b.y
  }
})
```

Run `npx silver-bench`. The output should look similar to this:

```
running benchmarks in /Users/eric/projects/silver-bench-test

/vec2.bench.ts
add  3,759,398 ops/s
```

Finally, run `npx silver-bench` again. You'll now see the delta between the previous run and the latest run to the right of the perf results:

```
/vec2.bench.ts
add  3,623,188 ops/s  -0.45%
```

## Config

The benchmark tool is configurable through use of enivronment variables, command line arguments, and perf settings.

### Environment variables

```sh
# An object whose properties should be added to `globalThis` in your benchmark
# files.
BENCH_GLOBALS="{}"
# File extension used to locate benchmarks in the directory where `silver-bench`
# is run.
BENCH_MODULE_EXTENSION="bench.ts"
# File extension used for benchmark results. You may want to add this pattern
# to your gitignore file.
BENCH_RESULTS_EXTENSION="bench-results.csv"
# The unit of time used to report perf results.
PERF_UNIT="s"
# Number of perf results to discard on either end of the results spectrum. This
# option helps eliminate outliers caused by code optimization.
PERF_SAMPLES_TO_DISCARD_PER_EXTREME=100
# Number of times to run each perf.
PERF_ITERATIONS=2000
# The deviation at which perf results are reported in green and written to the
# perf results file.
PERF_SUCCESS_THRESHOLD=0.2
# The deviation at which perf results are reported in yellow and written to the
# perf results file.
PERF_WARNING_THRESHOLD=-0.2
# The deviation at which perf results are reported in red. Failures are not
# written to the perf results file.
PERF_FAILURE_THRESHOLD=-0.3
# If true, failures are written to the perf results file. This is useful if you
# make a change where you expect a degradation in performance.
WRITE_FAILURES=false
```

### Perf settings

You can define a perf with the desired number of iterations using `perf().iterations(n)`:

```ts
perf("add", () => {
  let x = 1
  let y = 1
  return () => x + y
}).iterations(15_000)
```
