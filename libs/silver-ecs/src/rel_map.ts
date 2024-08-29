import * as SparseSet from "./sparse_set"

interface RelMap<U extends number> {
  set_object(source: U, target: U): void
  has_subject(source: U): boolean
  delete_object(target: U): void
  delete_subject(source: U): void
}

class RelMap<U extends number> implements RelMap<U> {
  a_to_b
  b_to_a

  constructor() {
    this.a_to_b = [] as SparseSet.T<U>[]
    this.b_to_a = [] as SparseSet.T<U>[]
  }

  set_object(source: U, target: U) {
    let b = (this.a_to_b[source] ??= SparseSet.make())
    let a = (this.b_to_a[target] ??= SparseSet.make())
    SparseSet.add(b, target)
    SparseSet.add(a, source)
  }

  has_subject(source: U): boolean {
    return this.a_to_b[source] !== undefined
  }

  delete_object(target: U) {
    let a = this.b_to_a[target]
    if (a === undefined) {
      return
    }
    SparseSet.each(a, source => {
      let b = this.a_to_b[source]
      if (b === undefined) {
        return
      }
      SparseSet.delete(b, target)
      if (SparseSet.size(b) === 0) {
        delete this.a_to_b[source]
      }
    })
    delete this.b_to_a[target]
  }

  delete_subject(source: U) {
    let b = this.a_to_b[source]
    if (b === undefined) {
      return
    }
    SparseSet.each(b, target => {
      let a = this.b_to_a[target]
      if (a === undefined) {
        return
      }
      SparseSet.delete(a, source)
      if (SparseSet.size(a) === 0) {
        delete this.b_to_a[target]
      }
    })
    delete this.a_to_b[source]
  }
}

export type T<U extends number = number> = RelMap<U>

export let make = <U extends number>(): T<U> => new RelMap<U>()

if (import.meta.vitest) {
  let {test, expect} = await import("vitest")

  test("relmap", () => {
    let relmap = new RelMap<number>()
    relmap.set_object(1, 2)
    relmap.set_object(1, 3)
    relmap.set_object(2, 3)
    expect(relmap.has_subject(1)).to.equal(true)
    expect(relmap.has_subject(2)).to.equal(true)
    relmap.delete_subject(1)
    expect(relmap.has_subject(1)).to.equal(false)
    expect(relmap.has_subject(2)).to.equal(true)
    relmap.delete_object(3)
    expect(relmap.has_subject(1)).to.equal(false)
    expect(relmap.has_subject(2)).to.equal(false)
  })
}
