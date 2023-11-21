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
  let denseIndex = map.sparse[key]
  if (denseIndex === undefined) return undefined
  return map.dense[denseIndex]
}

export let set = <U>(map: SparseMap<U>, key: number, value: U): void => {
  let denseIndex = map.sparse[key]
  if (denseIndex === undefined) {
    map.sparse[key] = map.dense.length
    map.dense.push(value)
    map.indices.push(key)
  } else {
    map.dense[denseIndex] = value
  }
}

export let has = (map: SparseMap, key: number): boolean =>
  map.sparse[key] !== undefined

let delete_ = (map: SparseMap, key: number): void => {
  let denseIndex = map.sparse[key]
  if (denseIndex === undefined) return
  let sparseIndex = map.indices[map.indices.length - 1]
  map.dense[denseIndex] = map.dense[map.dense.length - 1]
  map.dense.pop()
  map.indices[denseIndex] = sparseIndex
  map.indices.pop()
  map.sparse[sparseIndex] = denseIndex
  map.sparse[key] = undefined!
}
export {delete_ as delete}

export let eachValue = <U>(
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

export let toSparseArray = <U>(map: SparseMap<U>): U[] => {
  let sparse = new Array(map.sparse.length)
  for (let i = 0; i < map.dense.length; i++) {
    sparse[map.indices[i]] = map.dense[i]
  }
  return sparse
}
