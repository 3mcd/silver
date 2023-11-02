import {perf} from "silver-bench"
import * as SparseMap from "./sparse_map"

let fixture = (insert = true) => {
  let map = SparseMap.make()
  if (insert) {
    for (let i = 0; i < 1_000; i++) {
      SparseMap.set(map, i, i)
    }
  }
  return {map}
}

perf("add 1000 entries", () => {
  let {map} = fixture(false)
  return () => {
    for (let i = 0; i < 1_000; i++) {
      SparseMap.set(map, i, i)
    }
  }
})

perf("get 1000 values", () => {
  let {map} = fixture()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      SparseMap.get(map, i)
    }
  }
})

perf("has 1000 entries", () => {
  let {map} = fixture()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      SparseMap.has(map, i)
    }
  }
})

perf("delete 1000 entries", () => {
  let {map} = fixture()
  return () => {
    for (let i = 0; i < 1_000; i++) {
      SparseMap.delete(map, i)
    }
  }
})

perf("iterate 1000 entries", () => {
  let {map} = fixture()
  return () => {
    SparseMap.each(map, () => {})
  }
})

perf("clear 1000 entries", () => {
  let {map} = fixture()
  return () => {
    SparseMap.clear(map)
  }
})
