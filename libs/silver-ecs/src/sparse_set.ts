type ForEachIteratee<U extends number> = (value: U) => void

export class SparseSet<U extends number> {
  dense: U[]
  sparse: number[]

  constructor() {
    this.dense = []
    this.sparse = []
  }

  has(value: U): boolean {
    return this.sparse[value] !== undefined
  }

  add(value: U): number {
    return (this.sparse[value] ??= this.dense.push(value) - 1)
  }

  at(index: number): U {
    return this.dense[index]
  }

  indexOf(value: U): number {
    return this.sparse[value] ?? -1
  }

  delete(value: U): void {
    let index = this.sparse[value]
    if (index !== undefined) {
      let key = this.dense[this.dense.length - 1]
      this.dense[index] = key
      this.dense.pop()
      this.sparse[key] = index
      this.sparse[value] = undefined!
    }
  }

  clear(): void {
    let value: number | undefined
    while ((value = this.dense.pop()) !== undefined) {
      this.sparse[value] = undefined!
    }
  }

  values(): U[] {
    return this.dense
  }

  size(): number {
    return this.dense.length
  }

  for_each(iteratee: ForEachIteratee<U>): void {
    for (let i = this.dense.length - 1; i >= 0; i--) {
      iteratee(this.dense[i])
    }
  }
}

export type T<U extends number = number> = SparseSet<U>

export let make = <U extends number>(): T<U> => {
  return new SparseSet<U>()
}
