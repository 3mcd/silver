type ForEachEntryIteratee<U> = (key: number, value: U) => void
type ForEachValueIteratee<U> = (value: U) => void

export class SparseMap<U = unknown> {
  dense: U[]
  sparse: number[]
  indices: number[]

  constructor() {
    this.dense = []
    this.sparse = []
    this.indices = []
  }
}
export type T<U = unknown> = SparseMap<U>

export let make = <U>(init?: (U | undefined)[]): SparseMap<U> => {
  let map = new SparseMap<U>()
  if (init !== undefined) {
    init.forEach((value, key) => {
      if (value !== undefined) {
        set(map, key, value)
      }
    })
  }
  return map
}

export let size = (map: SparseMap): number => {
  return map.dense.length
}

export let get = <U>(map: SparseMap<U>, key: number): U | undefined => {
  let dense_index = map.sparse[key]
  if (dense_index === undefined) return undefined
  return map.dense[dense_index]
}

export let set = <U>(map: SparseMap<U>, key: number, value: U): void => {
  let dense_index = map.sparse[key]
  if (dense_index === undefined) {
    map.sparse[key] = map.dense.length
    map.dense.push(value)
    map.indices.push(key)
  } else {
    map.dense[dense_index] = value
  }
}

export let has = (map: SparseMap, key: number): boolean =>
  map.sparse[key] !== undefined

let delete_ = (map: SparseMap, key: number): void => {
  let dense_index = map.sparse[key]
  if (dense_index === undefined) return
  let sparse_index = map.indices[map.indices.length - 1]
  map.dense[dense_index] = map.dense[map.dense.length - 1]
  map.dense.pop()
  map.indices[dense_index] = sparse_index
  map.indices.pop()
  map.sparse[sparse_index] = dense_index
  map.sparse[key] = undefined!
}
export {delete_ as delete}

export let each_value = <U>(
  map: SparseMap<U>,
  iteratee: ForEachValueIteratee<U>,
): void => {
  for (let i = 0; i < map.dense.length; i++) {
    iteratee(map.dense[i])
  }
}

export let each = <U>(
  map: SparseMap<U>,
  iteratee: ForEachEntryIteratee<U>,
): void => {
  for (let i = map.dense.length - 1; i >= 0; i--) {
    iteratee(map.indices[i], map.dense[i])
  }
}

export let clear = (map: SparseMap): void => {
  let key: number | undefined = 0
  while ((key = map.indices.pop()) !== undefined) {
    map.dense.pop()
    map.sparse[key] = undefined!
  }
}

export let values = <U>(map: SparseMap<U>): U[] => {
  return map.dense
}

export let to_sparse_array = <U>(map: SparseMap<U>): U[] => {
  let sparse = new Array(map.sparse.length)
  for (let i = 0; i < map.dense.length; i++) {
    sparse[map.indices[i]] = map.dense[i]
  }
  return sparse
}

if (import.meta.vitest) {
  let {describe, it, expect} = await import("vitest")

  describe("SparseMap", () => {
    describe("make", () => {
      it("creates an empty SparseMap when no values are provided", () => {
        let map = make()
        expect(size(map)).toBe(0)
      })
      it("creates a SparseMap using a sparse array, initializing an entry for each index-value pair", () => {
        let map = make([, , , "a"])
        expect(size(map)).toBe(1)
        expect(get(map, 0)).toBe(undefined)
        expect(get(map, 1)).toBe(undefined)
        expect(get(map, 2)).toBe(undefined)
        expect(get(map, 3)).toBe("a")
      })
    })

    describe("get", () => {
      it("returns the value of a entry at the provided key", () => {
        let map = make(["a", "b"])
        expect(get(map, 0)).toBe("a")
        expect(get(map, 1)).toBe("b")
      })
      it("returns undefined for non-existing keys", () => {
        let map = make([, "a", "b"])
        expect(get(map, 0)).toBe(undefined)
      })
    })

    describe("set", () => {
      it("creates new entries at non-existing keys", () => {
        let map = make()
        set(map, 99, "a")
        set(map, 42, "b")
        expect(size(map)).toBe(2)
        expect(get(map, 99)).toBe("a")
        expect(get(map, 42)).toBe("b")
      })
      it("updates existing entries", () => {
        let map = make()
        set(map, 0, "a")
        set(map, 1, "b")
        set(map, 0, "c")
        set(map, 1, "d")
        expect(size(map)).toBe(2)
        expect(get(map, 0)).toBe("c")
        expect(get(map, 1)).toBe("d")
      })
    })

    describe("delete", () => {
      it("deletes the entry of the specified key", () => {
        let map = make(["a", "b", "c"])
        delete_(map, 1)
        expect(size(map)).toBe(2)
        expect(get(map, 0)).toBe("a")
        expect(get(map, 1)).toBe(undefined)
        expect(get(map, 2)).toBe("c")
      })
      it("does not alter the SparseMap when called with a non-existing key", () => {
        let map = make(["a", , "c"])
        delete_(map, 1)
        expect(size(map)).toBe(2)
        expect(get(map, 0)).toBe("a")
        expect(get(map, 1)).toBe(undefined)
        expect(get(map, 2)).toBe("c")
      })
    })

    describe("each", () => {
      it("executes a callback function with the value and key of each entry in the SparseMap", () => {
        let data: [number, string][] = [
          [0, "a"],
          [10_100, "b"],
          [9, "c"],
          [23, "d"],
          [1_000_000, "e"],
          [34, "f"],
        ]
        let entries: [number, string][] = []
        let map = make(
          data.reduce((a, [key, value]) => {
            a[key] = value
            return a
          }, [] as string[]),
        )
        let sort = (entries: [number, string][]) =>
          entries.sort(([key_a], [key_b]) => key_a - key_b)
        each(map, (key, value) => entries.push([key, value]))
        expect(sort(entries)).toEqual(sort(data))
      })
    })
  })
}
