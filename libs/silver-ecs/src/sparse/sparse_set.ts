type ForEachIteratee<U extends number> = (value: U) => void

export class SparseSet<U extends number> {
  dense: U[]
  sparse: number[]

  constructor() {
    this.dense = []
    this.sparse = []
  }
}
export type T<U extends number> = SparseSet<U>

export let make = <U extends number>(): SparseSet<U> => {
  return new SparseSet<U>()
}

export let has = <U extends number>(set: SparseSet<U>, value: U): boolean =>
  set.sparse[value] !== undefined

export let add = <U extends number>(set: SparseSet<U>, value: U): void => {
  set.sparse[value] ??= set.dense.push(value) - 1
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

if (import.meta.vitest) {
  let {describe, it, expect} = await import("vitest")

  describe("make", () => {
    it("creates an empty sparse set", () => {
      let set = make()
      expect(size(set)).equal(0)
      expect(values(set)).toEqual([])
    })
  })

  describe("has", () => {
    it("returns true if the set contains the value", () => {
      let set = make()
      add(set, 1)
      expect(has(set, 1)).true
    })
    it("returns false if the set does not contain the value", () => {
      let set = make()
      expect(has(set, 1)).false
    })
  })

  describe("add", () => {
    it("adds the value to the set", () => {
      let set = make()
      add(set, 1)
      expect(has(set, 1)).true
    })
    it("does not add the value if it already exists in the set", () => {
      let set = make()
      add(set, 1)
      add(set, 1)
      expect(size(set)).equal(1)
    })
  })

  describe("delete", () => {
    it("removes the value from the set", () => {
      let set = make()
      add(set, 1)
      delete_(set, 1)
      expect(has(set, 1)).false
    })
    it("does nothing if the value does not exist in the set", () => {
      let set = make()
      delete_(set, 1)
      expect(size(set)).equal(0)
    })
  })

  describe("clear", () => {
    it("removes all values from the set", () => {
      let set = make()
      add(set, 1)
      add(set, 2)
      clear(set)
      expect(size(set)).equal(0)
    })
  })

  describe("values", () => {
    it("returns an array of the set's values", () => {
      let set = make()
      add(set, 1)
      add(set, 2)
      expect(values(set)).toEqual([1, 2])
    })
  })

  describe("size", () => {
    it("returns the number of values in the set", () => {
      let set = make()
      add(set, 1)
      add(set, 2)
      expect(size(set)).equal(2)
    })
  })

  describe("each", () => {
    it("iterates over the set's values", () => {
      let set = make()
      add(set, 1)
      add(set, 2)
      let values: number[] = []
      each(set, value => values.push(value))
      expect(values.sort()).toEqual([1, 2])
    })
  })
}
