import * as Component from "./component.ts"
import * as Entity from "./entity.ts"
import * as Hash from "./hash.ts"

/**
 * Create an ordered collection of unique components from a unrestricted array
 * of components.
 */
let to_vec = (components: Component.t[]) => {
  let unique = new Set<Component.t>()
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

  constructor(vec: Component.t[], vec_hash: number) {
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

  is_superset(other: Type): boolean {
    if (this.vec.length === 0) {
      return false
    }
    if (other.vec.length === 0) {
      return true
    }
    if (this.vec_hash === other.vec_hash) {
      return false
    }
    let ia = 0
    let ib = 0
    while (ia < this.vec.length && ib < other.vec.length) {
      let ida = this.vec[ia].id
      let idb = other.vec[ib].id
      if (ida < idb) {
        ia++
      } else if (ida > idb) {
        return false
      } else {
        ia++
        ib++
      }
    }
    return ib === other.vec.length
  }

  xor_hash(other: Type): number {
    if (this.vec_hash === other.vec_hash) {
      return 0
    }
    let xor = 0
    let ia = 0
    let ib = 0
    while (ia < this.vec.length && ib < other.vec.length) {
      let ida = this.vec[ia].id
      let idb = other.vec[ib].id
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
    while (ia < this.vec.length) {
      xor = Hash.hash_word(xor, this.vec[ia].id)
      ia++
    }
    while (ib < other.vec.length) {
      xor = Hash.hash_word(xor, other.vec[ib].id)
      ib++
    }
    return xor
  }

  xor_hash_u(other: Type): number {
    return this.xor_hash(other) >>> 0
  }

  from_sum(other: Type): Type {
    let sum = this.vec.concat(other.vec)
    for (let i = 0; i < other.pairs.length; i++) {
      let pair = other.pairs[i]
      let pair_rel_id = Component.parse_pair_rel_id(pair)
      if (!this.has_component_id(pair_rel_id)) {
        let pair_rel = Component.find_by_id(pair_rel_id)!
        sum.push(pair_rel)
      }
    }
    return make(sum)
  }

  from_difference(other: Type): Type {
    let components: Component.t[] = []
    outer: for (let i = 0; i < this.vec.length; i++) {
      let component = this.vec[i]
      if (!other.has_component(component)) {
        if (Component.is_rel(component)) {
          for (let j = 0; j < this.pairs.length; j++) {
            let pair = this.pairs[j]
            let pair_rel_id = Component.parse_pair_rel_id(pair)
            if (
              this.pair_counts[pair_rel_id] === other.pair_counts[pair_rel_id]
            ) {
              continue outer
            }
          }
        }
        components.push(component)
      }
    }
    return make(components)
  }

  from_intersection(other: Type): Type {
    let components: Component.t[] = []
    for (let i = 0; i < this.vec.length; i++) {
      let component = this.vec[i]
      if (other.has_component(component)) {
        components.push(component)
      }
    }
    return make(components)
  }

  has_component(component: Component.t): boolean {
    return this.set.has(component.id)
  }

  has_component_id(component_id: number): boolean {
    return this.set.has(component_id)
  }

  with_component(component: Component.t): Type {
    return make(this.vec.concat(component))
  }

  without_component(component: Component.t): Type {
    return make(this.vec.filter(c => c.id !== component.id))
  }
}

export type t = Type

let cache: Type[] = []
let cache_vec: Type[] = []

/**
 * Create a type from an unrestricted array of components.
 *
 * This function returns the same type instance for the same array of
 * components, meaning types created with this function can be compared by
 * reference.
 */
export let make = (components: Component.t[]) => {
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

export let single = (component: Component.t) => {
  return make([component])
}

export let empty = make([])
