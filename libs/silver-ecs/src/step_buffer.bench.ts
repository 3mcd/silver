import {perf} from "silver-bench"
import * as StepBuffer from "./step_buffer"

perf("insert 1000 values", () => {
  const buffer = StepBuffer.make<number>()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      StepBuffer.insert(buffer, i % 500, i)
    }
  }
})

perf("drain 1000 values", () => {
  const buffer = StepBuffer.make<number>()
  for (let i = 0; i < 1_000; i++) {
    StepBuffer.insert(buffer, i % 500, i)
  }
  return () => {
    StepBuffer.drainTo(buffer, 500)
  }
})
