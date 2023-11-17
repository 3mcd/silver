type BTreeMapCompare<K> = (a: K, b: K) => number

type BTreeMapForEachIterator<K extends number, V> = (
  values: V[],
  key: K,
) => void

type BTreeMapOptions<K> = {
  compare?: BTreeMapCompare<K>
  order?: number
}

let compare = (a: number, b: number): number => (a < b ? -1 : a > b ? 1 : 0)

export class BTreeMap<V, K extends number = number> {
  compare: BTreeMapCompare<K> = compare
  values: V[][] = []
  order: number = 3
  root: NodeBase<K>
  size = 0

  constructor(options: BTreeMapOptions<K> = {}) {
    if (options.compare !== undefined) {
      this.compare = options.compare
    }
    if (options.order !== undefined) {
      this.order = options.order
    }
    this.root = new Leaf(this.order, this.compare)
  }

  get lo(): K {
    return this.root.lo
  }

  get hi(): K {
    return this.root.hi
  }

  has(key: K): boolean {
    return this.values[key] !== undefined
  }

  set(key: K, value: V): BTreeMap<V, K> {
    let values = this.values[key]
    if (values !== undefined) {
      values.push(value)
    } else {
      this.values[key] = [value]
      this.root.set(key)
      if (this.root.keys.length > this.root.max) {
        let root = new Node(this.order, this.compare)
        let node = this.root.split()
        root.keys.push(node.lo)
        root.children.push(this.root, node)
        this.root = root
      }
    }
    this.size++
    return this
  }

  get(lo: K): V[] {
    return this.values[lo]
  }

  delete(lo: K, hi?: K, inclusive?: boolean): boolean {
    if (hi) {
      let count = 0
      let leaf: Leaf<K> | null = this.root.find_leaf(lo)
      do {
        let keys = leaf.keys
        for (let i = 0, length = keys.length; i < length; i++) {
          let key = keys[i]
          if (
            this.compare(key, lo) >= 0 &&
            (inclusive ? this.compare(key, hi) <= 0 : this.compare(key, hi) < 0)
          ) {
            if (this.delete(key)) {
              count++
              this.size--
            }
          }
          if (this.compare(key, hi) > 0) break
        }
        leaf = leaf.next
      } while (leaf !== null)
      return count > 0 ? true : false
    } else {
      if (this.has(lo)) {
        this.values[lo] = undefined!
        this.root.delete(lo)
        if (this.root.keys.length === 0) {
          this.root = this.root.shrink()
        }
        return true
      } else {
        return false
      }
    }
  }

  clear(): void {
    this.values = []
    this.root = new Leaf(this.order, this.compare)
  }

  forEach(
    iteratee: BTreeMapForEachIterator<K, V>,
    lo = this.lo,
    hi = this.hi,
    inclusive: boolean = true,
  ): void {
    if (this.size === 0) return
    let leaf: Leaf<K> | null = this.root.find_leaf(lo)
    do {
      let keys = leaf.keys
      for (let i = 0, length = keys.length; i < length; i++) {
        let key = keys[i]
        if (
          this.compare(key, lo) >= 0 &&
          (inclusive ? this.compare(key, hi) <= 0 : this.compare(key, hi) < 0)
        )
          iteratee(this.values[key], key)
        if (this.compare(key, hi) > 0) break
      }
      leaf = leaf.next
    } while (leaf !== null)
  }
}

abstract class NodeBase<K extends number> {
  keys: K[]
  constructor(
    public readonly order: number,
    public readonly compare: BTreeMapCompare<K>,
    public readonly min = Math.ceil(order / 2) - 1,
    public readonly max = order - 1,
  ) {
    this.keys = []
  }
  abstract get lo(): K
  abstract get hi(): K
  abstract borrow_left(source: NodeBase<K>): void
  abstract borrow_right(source: NodeBase<K>): void
  abstract delete(key: K): void
  abstract find_leaf(key: K): Leaf<K>
  abstract merge(source: NodeBase<K>): void
  abstract set(key: K): void
  abstract shrink(): NodeBase<K>
  abstract split(): NodeBase<K>
}

class Node<V, K extends number> extends NodeBase<K> {
  children: NodeBase<K>[]

  constructor(order: number, compare: BTreeMapCompare<K>) {
    super(order, compare)
    this.children = []
  }

  get lo(): K {
    return this.children[0].lo
  }

  get hi(): K {
    return this.children[this.children.length - 1].hi
  }

  set(key: K): void {
    let slot = this.slot_of(key, this.keys, this.compare)
    let child = this.children[slot]
    if (child.keys.length > child.max) {
      let sibling
      if (slot > 0) {
        sibling = this.children[slot - 1]
        if (sibling.keys.length < sibling.max) {
          sibling.borrow_right(child)
          this.keys[slot - 1] = child.lo
        } else if (slot < this.children.length - 1) {
          sibling = this.children[slot + 1]
          if (sibling.keys.length < sibling.max) {
            sibling.borrow_left(child)
            this.keys[slot] = sibling.lo
          } else {
            this.split_child(child, slot)
          }
        } else {
          this.split_child(child, slot)
        }
      } else {
        sibling = this.children[1]
        if (sibling.keys.length < sibling.max) {
          sibling.borrow_left(child)
          this.keys[slot] = sibling.lo
        } else {
          this.split_child(child, slot)
        }
      }
    }
  }

  delete(key: K): void {
    let keys = this.keys
    let slot = this.slot_of(key, keys, this.compare)
    let child = this.children[slot]
    child.delete(key)
    if (slot > 0) keys[slot - 1] = child.lo
    if (child.keys.length < child.min) this.consolidate_child(child, slot)
  }

  find_leaf(key: K): Leaf<K> {
    let slot = this.slot_of(key, this.keys, this.compare)
    return this.children[slot].find_leaf(key)
  }

  split(): Node<V, K> {
    let node = new Node(this.order, this.compare)
    node.keys = this.keys.splice(this.min)
    node.keys.shift()
    node.children = this.children.splice(this.min + 1)
    return node
  }

  shrink(): NodeBase<K> {
    return this.children[0]
  }

  borrow_left(source: Node<V, K>): void {
    this.keys.unshift(this.lo)
    source.keys.pop()
    this.children.unshift(source.children.pop()!)
  }

  borrow_right(source: Node<V, K>): void {
    this.keys.push(source.lo)
    source.keys.shift()
    this.children.push(source.children.shift()!)
  }

  merge(source: Node<V, K>): void {
    this.keys.push(source.lo)
    for (let i = 0; i < source.keys.length; i++) {
      this.keys.push(source.keys[i])
    }
    for (let i = 0; i < source.children.length; i++) {
      this.children.push(source.children[i])
    }
  }

  split_child(child: NodeBase<K>, slot: number): void {
    let new_child = child.split()
    this.keys.splice(slot, 0, new_child.lo)
    this.children.splice(slot + 1, 0, new_child)
  }

  consolidate_child(child: NodeBase<K>, slot: number): void {
    let keys = this.keys
    let children = this.children
    let sibling
    if (slot > 0) {
      sibling = children[slot - 1]
      if (sibling.keys.length > sibling.min) {
        child.borrow_left(sibling)
        keys[slot - 1] = child.lo
      } else if (slot < this.children.length - 1) {
        sibling = children[slot + 1]
        if (sibling.keys.length > sibling.min) {
          child.borrow_right(sibling)
          keys[slot] = sibling.lo
        } else {
          children[slot - 1].merge(child)
          keys.splice(slot - 1, 1)
          children.splice(slot, 1)
        }
      } else {
        children[slot - 1].merge(child)
        keys.splice(slot - 1, 1)
        children.splice(slot, 1)
      }
    } else {
      sibling = children[slot + 1]
      if (sibling.keys.length > sibling.min) {
        child.borrow_right(sibling)
        keys[slot] = sibling.lo
      } else {
        child.merge(children[1])
        keys.splice(0, 1)
        children.splice(1, 1)
      }
    }
  }

  slot_of(element: K, array: K[], compare: BTreeMapCompare<K>): number {
    let top = array.length
    let middle = top >>> 1
    let bottom = 0
    while (bottom < top) {
      let comparison = compare(element, array[middle])
      if (comparison === 0) {
        return middle + 1
      } else if (comparison < 0) {
        top = middle
      } else {
        bottom = middle + 1
      }
      middle = bottom + ((top - bottom) >>> 1)
    }
    return middle
  }
}

class Leaf<K extends number> extends NodeBase<K> {
  next: Leaf<K> | null

  constructor(order: number, compare: BTreeMapCompare<K>) {
    super(order, compare, Math.ceil(order / 2), order)
    this.next = null
  }

  get lo() {
    return this.keys[0]
  }

  get hi() {
    return this.keys[this.keys.length - 1]
  }

  set(key: K): void {
    if (this.keys.length === 0) {
      this.keys.push(key)
    } else {
      let slot = this.slot_of(key, this.keys, this.compare)
      this.keys.splice(slot, 0, key)
    }
  }

  delete(key: K): void {
    this.keys.splice(this.keys.indexOf(key), 1)
  }

  find_leaf(): Leaf<K> {
    return this
  }

  split(): Leaf<K> {
    let leaf = new Leaf<K>(this.order, this.compare)
    leaf.keys = this.keys.splice(this.min)
    leaf.next = this.next
    this.next = leaf
    return leaf
  }

  shrink(): Leaf<K> {
    return new Leaf<K>(this.order, this.compare)
  }

  borrow_left(source: Leaf<K>): void {
    this.keys.unshift(source.keys.pop()!)
  }

  borrow_right(source: Leaf<K>): void {
    this.keys.push(source.keys.shift()!)
  }

  merge(source: Leaf<K>): void {
    for (let i = 0; i < source.keys.length; i++) {
      this.keys.push(source.keys[i])
    }
    this.next = source.next
  }

  slot_of(element: K, array: K[], compare: BTreeMapCompare<K>): number {
    let top = array.length
    let middle = top >>> 1
    let bottom = 0
    while (bottom < top) {
      let comparison = compare(element, array[middle])
      if (comparison === 0) {
        return middle + 1
      } else if (comparison < 0) {
        top = middle
      } else {
        bottom = middle + 1
      }
      middle = bottom + ((top - bottom) >>> 1)
    }
    return middle
  }
}

export class Stage<U> {
  map = new BTreeMap<U>()
  min = 0
  max = 0
}
export type T<U> = Stage<U>

export function make<U>(): T<U> {
  return new Stage()
}

export let insert = <U>(buffer: T<U>, time: number, event: U) => {
  buffer.map.set(time, event)
  if (time < buffer.min) {
    buffer.min = time
  } else if (time > buffer.max) {
    buffer.max = time
  }
}

export let _delete = <U>(buffer: T<U>, time: number) => {
  buffer.map.delete(buffer.min, time, true)
  buffer.min = time
}
export {_delete as delete}

export let delete_range = <U>(buffer: T<U>, time: number) => {
  buffer.map.delete(buffer.min, time, true)
  buffer.min = time
}

export let drain_to = <U>(
  buffer: T<U>,
  time: number,
  iteratee?: (value: U, key: number) => void,
) => {
  if (iteratee) {
    buffer.map.forEach(
      (events: U[], key: number) => {
        for (let i = 0; i < events.length; i++) {
          iteratee(events[i], key)
        }
      },
      buffer.min,
      time,
      true,
    )
  }
  buffer.map.delete(buffer.min, time)
  buffer.min = time
}
