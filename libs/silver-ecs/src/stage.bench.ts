import {perf} from "silver-bench"
import * as Stage from "./stage"

perf("insert 1000 values", () => {
  let buffer = Stage.make<number>()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      Stage.insert(buffer, i % 500, i)
    }
  }
})

perf("drain 1000 values", () => {
  let buffer = Stage.make<number>()
  for (let i = 0; i < 1_000; i++) {
    Stage.insert(buffer, i % 500, i)
  }
  return () => {
    Stage.drain_to(buffer, 500)
  }
})
