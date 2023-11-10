type ForEachIteratee<U extends number> = (value: U) => void

export class SparseSet<U extends number> {
  dense: U[]
  sparse: number[]

  constructor() {
    this.dense = []
    this.sparse = []
  }
}
export type T<U extends number = number> = SparseSet<U>

export let make = <U extends number>(): SparseSet<U> => {
  return new SparseSet<U>()
}

export let has = <U extends number>(set: SparseSet<U>, value: U): boolean =>
  set.sparse[value] !== undefined

export let add = <U extends number>(set: SparseSet<U>, value: U): void => {
  set.sparse[value] ??= set.dense.push(value) - 1
}

export let index_of = <U extends number>(
  set: SparseSet<U>,
  value: U,
): number => {
  return set.sparse[value] ?? -1
}

let delete_ = <U extends number>(set: SparseSet<U>, value: U): void => {
  let index = set.sparse[value]
  if (index !== undefined) {
    let key = set.dense[set.dense.length - 1]
    set.dense[index] = key
    set.dense.pop()
    set.sparse[key] = index
    set.sparse[value] = undefined!
  }
}
export {delete_ as delete}

export let clear = <U extends number>(set: SparseSet<U>): void => {
  let value: number | undefined
  while ((value = set.dense.pop()) !== undefined) {
    set.sparse[value] = undefined!
  }
}

export let values = <U extends number>(set: SparseSet<U>): U[] => {
  return set.dense
}

export let size = <U extends number>(set: SparseSet<U>): number => {
  return set.dense.length
}

export let each = <U extends number>(
  set: SparseSet<U>,
  iteratee: ForEachIteratee<U>,
) => {
  for (let i = set.dense.length - 1; i >= 0; i--) {
    iteratee(set.dense[i])
  }
}
