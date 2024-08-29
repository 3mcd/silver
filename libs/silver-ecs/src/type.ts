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
      let rel_id = Entity.parse_hi(component.id)
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
  ids
  pairs
  refs
  rels
  rels_inverse
  vec
  vec_hash

  constructor(vec: Component.T[], vec_hash: number) {
    this.ids = new Set<number>()
    this.pairs = vec.filter(Component.is_pair)
    this.refs = vec.filter(Component.is_ref)
    this.rels = vec.filter(Component.is_rel)
    this.rels_inverse = vec.filter(Component.is_rel_inverse)
    this.vec = vec
    this.vec_hash = vec_hash
    for (let i = 0; i < vec.length; i++) {
      this.ids.add(vec[i].id)
    }
  }
}

export type T = Type

let cache: Type[] = []
let cache_vec: Type[] = []

/**
 * Create a type from an unrestricted array of components.
 *
 * This function returns the same type instance for the same set of components,
 * meaning types created with this function can be compared by reference.
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
 * Check if set `a` contains every component of set `b`.
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
 * Check if set `a` contains every component of set `b`.
 */
export let is_superset_fast = (a: T, b: T): boolean => {
  for (let i = 0; i < b.vec.length; i++) {
    if (a.ids.has(b.vec[i].id) === false) {
      return false
    }
  }
  return true
}

/**
 * Compute a unique integer that represents the difference between sets `a` and
 * `b`.
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
 * Compute a unique unsigned integer that represents the difference between sets
 * `a` and `b`.
 */
export let xor_hash_u = (a: T, b: T): number => {
  return xor_hash(a, b) >>> 0
}

/**
 * Compute the type that contains all components from sets `a` and `b`.
 */
export let sum = (a: T, b: T) => make(a.vec.concat(b.vec))

/**
 * Compute the type that contains all components that are unique to set `a`.
 */
export let difference = (a: T, b: T) => {
  let components: Component.T[] = []
  for (let i = 0; i < a.vec.length; i++) {
    let component = a.vec[i]
    if (has_component(b, component) === false) {
      components.push(component)
    }
  }
  return make(components)
}

/**
 * Compute the type that contains all components that are common to both sets `a`
 * and `b`.
 */
export let intersection = (a: T, b: T) => {
  let common: Component.T[] = []
  for (let i = 0; i < a.vec.length; i++) {
    let component = a.vec[i]
    if (has_component(b, component)) {
      common.push(component)
    }
  }
  return make(common)
}

/**
 * Check if set `a` contains component `component`.
 */
export let has_component = (a: T, component: Component.T): boolean => {
  return a.ids.has(component.id)
}

/**
 * Check if set `a` contains component with id `component_id`.
 */
export let has_component_id = (a: T, component_id: number): boolean => {
  return a.ids.has(component_id)
}

/**
 * Add component `component` to set `a`.
 */
export let with_component = (a: T, component: Component.T) =>
  make(a.vec.concat(component))

/**
 * Remove component `component` from set `a`.
 */
export let without_component = (a: T, component: Component.T) =>
  make(a.vec.filter(c => c.id !== component.id))

if (import.meta.vitest) {
  let {test, expect} = await import("vitest")

  test("compare by reference", () => {
    let A = Component.tag()
    let B = Component.tag()
    let a = make([A, B])
    let b = make([B, A])
    expect(a === b).to.equal(true)
  })

  test("is_superset", () => {
    let A = Component.tag()
    let B = Component.tag()
    let C = Component.tag()
    let ab = make([A, B])
    let bac = make([B, A, C])
    expect(is_superset(bac, ab)).to.equal(true)
    expect(is_superset(ab, bac)).to.equal(false)
  })

  test("is_superset_fast", () => {
    let A = Component.tag()
    let B = Component.tag()
    let C = Component.tag()
    let ab = make([A, B])
    let bac = make([B, A, C])
    expect(is_superset_fast(bac, ab)).to.equal(true)
    expect(is_superset_fast(ab, bac)).to.equal(false)
  })

  test("xor_hash", () => {
    let A = Component.tag()
    let B = Component.tag()
    let C = Component.tag()
    let D = Component.tag()
    let E = Component.tag()
    let F = Component.tag()
    let ab = make([A, B])
    let cd = make([C, D])
    let ef = make([E, F])
    let xor_ab_cd = xor_hash(ab, cd)
    let xor_ab_ef = xor_hash(ab, ef)
    expect(xor_ab_cd).not.toBeNaN()
    expect(xor_ab_ef).not.toBeNaN()
    expect(xor_ab_cd).not.toEqual(xor_ab_ef)
  })

  test("intersection", () => {
    let A = Component.tag()
    let B = Component.tag()
    let C = Component.tag()
    let a = make([A])
    let b = make([B])
    let c = make([C])
    let ab = make([A, B])
    let bc = make([B, C])
    let abc = make([A, B, C])
    expect(intersection(ab, bc)).toEqual(b)
    expect(intersection(ab, abc)).toEqual(ab)
    expect(intersection(bc, abc)).toEqual(bc)
    expect(intersection(a, b)).toEqual(empty)
    expect(intersection(a, c)).toEqual(empty)
  })

  test("has_component", () => {
    let A = Component.tag()
    let B = Component.tag()
    let a = make([A])
    let b = make([B])
    expect(has_component(a, A)).to.equal(true)
    expect(has_component(a, B)).to.equal(false)
    expect(has_component(b, A)).to.equal(false)
    expect(has_component(b, B)).to.equal(true)
  })

  test("has_component_id", () => {
    let A = Component.tag()
    let B = Component.tag()
    let a = make([A])
    let b = make([B])
    expect(has_component_id(a, A.id)).to.equal(true)
    expect(has_component_id(a, B.id)).to.equal(false)
    expect(has_component_id(b, A.id)).to.equal(false)
    expect(has_component_id(b, B.id)).to.equal(true)
  })
}
