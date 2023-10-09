import {perf} from "silver-bench"
import * as Hash from "./hash"

perf("hash 1000 words", () => {
  const words = Array.from({length: 1000}, (_, i) => i)
  return () => {
    Hash.words(words)
  }
})
