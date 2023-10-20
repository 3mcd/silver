import {perf} from "silver-bench"
import * as Step_buffer from "./stage"

perf("insert 1000 values", () => {
  const buffer = Step_buffer.make<number>()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      Step_buffer.insert(buffer, i % 500, i)
    }
  }
})

perf("drain 1000 values", () => {
  const buffer = Step_buffer.make<number>()
  for (let i = 0; i < 1_000; i++) {
    Step_buffer.insert(buffer, i % 500, i)
  }
  return () => {
    Step_buffer.drain_to(buffer, 500)
  }
})
