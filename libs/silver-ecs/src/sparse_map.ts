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

  get(key: number): U | undefined {
    let dense_index = this.sparse[key]
    if (dense_index === undefined) return undefined
    return this.dense[dense_index]
  }

  set(key: number, value: U): void {
    let dense_index = this.sparse[key]
    if (dense_index === undefined) {
      this.sparse[key] = this.dense.length
      this.dense.push(value)
      this.indices.push(key)
    } else {
      this.dense[dense_index] = value
    }
  }

  has(key: number): boolean {
    return this.sparse[key] !== undefined
  }

  delete(key: number): void {
    let dense_index = this.sparse[key]
    if (dense_index === undefined) return
    let sparse_index = this.indices[this.indices.length - 1]
    this.dense[dense_index] = this.dense[this.dense.length - 1]
    this.dense.pop()
    this.indices[dense_index] = sparse_index
    this.indices.pop()
    this.sparse[sparse_index] = dense_index
    this.sparse[key] = undefined!
  }

  size(): number {
    return this.dense.length
  }

  clear(): void {
    let key: number | undefined = 0
    while ((key = this.indices.pop()) !== undefined) {
      this.dense.pop()
      this.sparse[key] = undefined!
    }
  }

  values(): ReadonlyArray<U> {
    return this.dense
  }

  to_sparse_array(): U[] {
    let sparse = new Array(this.sparse.length)
    for (let i = 0; i < this.dense.length; i++) {
      sparse[this.indices[i]] = this.dense[i]
    }
    return sparse
  }

  for_each(iteratee: ForEachEntryIteratee<U>): void {
    for (let i = this.dense.length - 1; i >= 0; i--) {
      iteratee(this.indices[i], this.dense[i])
    }
  }

  each_value(iteratee: ForEachValueIteratee<U>): void {
    for (let i = 0; i < this.dense.length; i++) {
      iteratee(this.dense[i])
    }
  }
}

export type T<U = unknown> = SparseMap<U>

export let make = <U>(init?: (U | undefined)[]): T<U> => {
  let map = new SparseMap<U>()
  if (init !== undefined) {
    init.forEach((value, key) => {
      if (value !== undefined) {
        map.set(key, value)
      }
    })
  }
  return map
}
