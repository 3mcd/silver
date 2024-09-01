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

  has_subject(subject: U): boolean {
    return this.a_to_b[subject] !== undefined
  }

  delete(subject: U, object: U) {
    let b = this.a_to_b[subject]
    if (b === undefined) {
      return 0
    }
    let a = this.b_to_a[object]
    if (a === undefined) {
      return 0
    }
    let res = 0
    SparseSet.delete(b, object)
    if (SparseSet.size(b) === 0) {
      delete this.a_to_b[subject]
      res |= 1
    }
    SparseSet.delete(a, subject)
    if (SparseSet.size(a) === 0) {
      delete this.b_to_a[object]
      res |= 2
    }
    return res
  }

  delete_object(object: U) {
    let a = this.b_to_a[object]
    if (a === undefined) {
      return
    }
    SparseSet.each(a, subject => {
      let b = this.a_to_b[subject]
      if (b === undefined) {
        return
      }
      SparseSet.delete(b, object)
      if (SparseSet.size(b) === 0) {
        delete this.a_to_b[subject]
      }
    })
    delete this.b_to_a[object]
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
