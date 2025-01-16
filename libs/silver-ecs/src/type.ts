import * as Component from "./component"
import * as Hash from "./hash"
import * as Entity from "./entity"

/**
 * Create an ordered collection of unique components from a unrestricted array
 * of components.
 */
let to_vec = (components: Component.T[]) => {
  let unique = new Set<Component.T>()
  for (let i = 0; i < components.length; i++) {
    let component = components[i]
    if (unique.has(component)) {
      continue
    }
    unique.add(component)
    if (Component.is_pair(component)) {
      let rel_id = Component.parse_pair_rel_id(component)
      let rel = Component.find_by_id(rel_id)!
      if (unique.has(rel)) {
        continue
      }
      unique.add(rel)
    }
  }
  return Array.from(unique).sort((a, b) => a.id - b.id)
}

/**
 * A type is a unique, ordered set of components that can be compared to other
 * types.
 */
class Type {
  pairs
  pair_counts
  refs
  rels
  rels_inverse
  set;
  vec
  vec_hash

  constructor(vec: Component.T[], vec_hash: number) {
    this.pairs = vec.filter(Component.is_pair)
    this.refs = vec.filter(Component.is_ref)
    this.rels = vec.filter(Component.is_rel)
    this.pair_counts = [] as number[]
    this.rels_inverse = vec.filter(Component.is_rel_inverse)
    this.set = new Set<number>()
    this.vec = vec
    this.vec_hash = vec_hash
    for (let i = 0; i < vec.length; i++) {
      this.set.add(vec[i].id)
    }
    for (let i = 0; i < this.pairs.length; i++) {
      let pair = this.pairs[i]
      let pair_rel_id = Component.parse_pair_rel_id(pair)
      this.pair_counts[pair_rel_id] = (this.pair_counts[pair_rel_id] ?? 0) + 1
    }
  }
}

export type T = Type

let cache: Type[] = []
let cache_vec: Type[] = []

/**
 * Create a type from an unrestricted array of components.
 *
 * This function returns the same type instance for the same array of
 * components, meaning types created with this function can be compared by
 * reference.
 */
export let make = (components: Component.T[]) => {
  let components_hash = Hash.hash_words(components.map(c => c.id))
  if (cache[components_hash] !== undefined) {
    return cache[components_hash]
  }
  let vec = to_vec(components)
  let vec_hash = Hash.hash_words(vec.map(c => c.id))
  if (cache_vec[vec_hash] !== undefined) {
    return (cache[components_hash] = cache_vec[vec_hash])
  }
  return (cache[components_hash] = cache_vec[vec_hash] =
    new Type(vec, vec_hash))
}

export let empty = make([])

/**
 * Check if type `a` contains every component of type `b`.
 */
export let is_superset = (a: T, b: T): boolean => {
  // This type is an empty type.
  if (a.vec.length === 0) {
    return false
  }
  // Compared type is an empty type.
  if (b.vec.length === 0) {
    return true
  }
  // Compared type is equivalent to this type.
  if (a.vec_hash === b.vec_hash) {
    return false
  }
  let ia = 0
  let ib = 0
  while (ia < a.vec.length && ib < b.vec.length) {
    let ida = a.vec[ia].id
    let idb = b.vec[ib].id
    if (ida < idb) {
      ia++
    } else if (ida > idb) {
      return false
    } else {
      ia++
      ib++
    }
  }
  return ib === b.vec.length
}

/**
 * Compute a unique integer that represents the difference between types `a`
 * and `b`.
 */
export let xor_hash = (a: T, b: T): number => {
  if (a.vec_hash === b.vec_hash) {
    return 0
  }
  let xor = 0
  let ia = 0
  let ib = 0
  while (ia < a.vec.length && ib < b.vec.length) {
    let ida = a.vec[ia].id
    let idb = b.vec[ib].id
    if (ida === idb) {
      ia++
      ib++
    } else if (ida < idb) {
      xor = Hash.hash_word(xor, ida)
      ia++
    } else if (ida > idb) {
      xor = Hash.hash_word(xor, idb)
      ib++
    }
  }
  while (ia < a.vec.length) {
    xor = Hash.hash_word(xor, a.vec[ia].id)
    ia++
  }
  while (ib < b.vec.length) {
    xor = Hash.hash_word(xor, b.vec[ib].id)
    ib++
  }
  return xor
}

/**
 * Compute a unique unsigned integer that represents the difference between
 * types `a` and `b`.
 */
export let xor_hash_u = (a: T, b: T): number => {
  return xor_hash(a, b) >>> 0
}

/**
 * Compute the type that contains all components from types `a` and `b`.
 */
export let from_sum = (a: T, b: T) => {
  let components = a.vec.concat(b.vec)
  // add relations when the sum would add a new pair of that relation
  for (let i = 0; i < b.pairs.length; i++) {
    let pair = b.pairs[i]
    let pair_rel_id = Entity.parse_hi(pair.id)
    if (has_component_id(a, pair_rel_id) === false) {
      let pair_rel = Component.find_by_id(pair_rel_id)!
      components.push(pair_rel)
    }
  }
  return make(components)
}

/**
 * Compute the type that contains all components that are unique to type `a`.
 */
export let from_difference = (a: T, b: T) => {
  let components: Component.T[] = []
  outer: for (let i = 0; i < a.vec.length; i++) {
    let component = a.vec[i]
    if (has_component(b, component) === false) {
      // strip relations when the difference would remove all pairs of that
      // relation
      if (Component.is_rel(component)) {
        for (let j = 0; j < a.pairs.length; j++) {
          let pair = a.pairs[j]
          let pair_rel_id = Entity.parse_hi(pair.id)
          if (a.pair_counts[pair_rel_id] === b.pair_counts[pair_rel_id]) {
            continue outer
          }
        }
      }
      components.push(component)
    }
  }
  return make(components)
}

/**
 * Compute the type that contains all components that are common to both types `a`
 * and `b`.
 */
export let from_intersection = (a: T, b: T) => {
  let components: Component.T[] = []
  for (let i = 0; i < a.vec.length; i++) {
    let component = a.vec[i]
    if (has_component(b, component)) {
      components.push(component)
    }
  }
  return make(components)
}

/**
 * Check if type `a` contains component `component`.
 */
export let has_component = (a: T, component: Component.T): boolean => {
  return a.set.has(component.id)
}

/**
 * Check if type `a` contains component with id `component_id`.
 */
export let has_component_id = (a: T, component_id: number): boolean => {
  return a.set.has(component_id)
}

/**
 * Add component `component` to type `a`.
 */
export let with_component = (a: T, component: Component.T) =>
  make(a.vec.concat(component))

/**
 * Remove component `component` from type `a`.
 */
export let without_component = (a: T, component: Component.T) =>
  make(a.vec.filter(c => c.id !== component.id))
