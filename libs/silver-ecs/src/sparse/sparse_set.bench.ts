import {perf} from "silver-bench"
import * as SparseSet from "./sparse_set"

let fixture = (insert = true) => {
  let set = SparseSet.make()
  if (insert) {
    for (let i = 0; i < 1_000; i++) {
      SparseSet.add(set, i)
    }
  }
  return {set}
}

perf("add 1000 values", () => {
  let {set} = fixture(false)
  return () => {
    for (let i = 0; i < 1_000; i++) {
      SparseSet.add(set, i)
    }
  }
})

perf("has 1000 values", () => {
  let {set} = fixture()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      SparseSet.has(set, i)
    }
  }
})

perf("delete 1000 values", () => {
  let {set} = fixture()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      SparseSet.delete(set, i)
    }
  }
})

perf("clear 1000 values", () => {
  let {set} = fixture()
  return () => {
    SparseSet.clear(set)
  }
})

perf("iterate 1000 values", () => {
  let {set} = fixture()
  return () => {
    SparseSet.each(set, () => {})
  }
})
