import {perf} from "silver-bench"
import {cartesian, permute} from "./array"

perf("recombine 10 w/ 2 elements", () => {
  const arr = Array.from({length: 10}).fill(0)
  return () => {
    permute(arr, 2)
  }
})

perf("cartesian", () => {
  const arr = [[0, 1, 2], [3, 4], [5, 6, 7, 8], [9]]
  return () => {
    cartesian(arr)
  }
})
