import {perf} from "silver-bench"
import {product} from "./array"

perf("product", () => {
  const arr = [[0, 1, 2], [3, 4], [5, 6, 7, 8], [9]]
  return () => {
    product(arr)
  }
})
