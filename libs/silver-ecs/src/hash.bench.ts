import {perf} from "silver-bench"
import * as Hash from "./hash"

perf("hash 1000 words", () => {
  let words = Array.from({length: 1000}, (_, i) => i)
  return () => {
    Hash.hash_words(words)
  }
})
