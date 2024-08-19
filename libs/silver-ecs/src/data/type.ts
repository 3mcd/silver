import * as Assert from "../assert"
import * as Entity from "../entity/entity"
import * as Hash from "../hash"
import {ExcludeFromTuple} from "../types"
import * as Commands from "../world/op"
import * as Component from "./component"
import * as Schema from "./schema"

export type Normalized<
  U extends (Type | Component.T)[],
  Out extends Component.T[] = [],
> = U extends []
  ? Out
  : U extends [infer Head, ...infer Tail]
  ? Tail extends (Type | Component.T)[]
    ? Normalized<
        Tail,
        Head extends Type<infer V>
          ? [...Out, ...Normalized<V>]
          : Head extends Component.T
          ? [...Out, Head]
          : never
      >
    : never
  : never

export type Unitary<U extends Component.T = Component.T> = Type<[U]>

export enum PairState {
  None,
  Unpaired,
  Paired,
}

let make_sparse = (components: Component.T[]): number[] => {
  let sparse = []
  for (let i = 0; i < components.length; i++) {
    let component = components[i]
    if (
      Component.is_relation(component) &&
      sparse[component.id] !== undefined &&
      component.topology === Component.Topology.Exclusive
    ) {
      throw new Error(
        `Failed to construct type: type has multiple parents for hierarchical relation`,
      )
    }
    sparse[component.id] = i
  }
  return sparse
}

export class Type<U extends Component.T[] = Component.T[]> {
  def
  hash
  pair_state
  pair_counts
  pairs
  refs
  rels
  sparse
  vec
  vec_ids

  constructor(components: U) {
    let vec = components.slice().sort((a, b) => a.id - b.id)
    this.sparse = make_sparse(components)
    this.vec_ids = vec.map(component => component.id)
    this.vec = vec
    this.def = components
    this.hash = Hash.hash_words(this.vec_ids)
    this.refs = components.filter(Component.is_ref)
    this.rels = components.filter(Component.is_relation)
    this.pair_counts = [] as number[]
    this.pairs = vec.filter(Component.is_pair)
    this.pair_state =
      this.rels.length === 0
        ? PairState.None
        : this.rels.length === this.pairs.length
        ? PairState.Paired
        : PairState.Unpaired
    for (let i = 0; i < this.rels.length; i++) {
      let rel = this.rels[i]
      for (let j = 0; j < this.pairs.length; j++) {
        let pair = this.pairs[j]
        let pair_rel_id = Entity.parse_hi(pair.id)
        if (pair_rel_id === rel.id) {
          this.pair_counts[rel.id] = (this.pair_counts[rel.id] || 0) + 1
        }
      }
    }
  }

  make(
    init?: U[0] extends Component.Ref<infer V> ? Partial<V> : never,
  ): U[0] extends Component.Ref<infer V> ? V : never {
    let ref = this.def[0]
    if (Component.is_ref(ref) && ref.schema !== undefined) {
      let value = Schema.initialize(ref.schema) as U[0] extends Component.Ref<
        infer V
      >
        ? V
        : never
      if (ref.initialize === undefined) {
        return value
      }
      return ref.initialize(
        typeof ref.schema === "object"
          ? Object.assign(value as {}, init)
          : value,
      )
    }
    throw new Error(
      `Failed to initialize component value: component is missing schema`,
    )
  }
}
export type T<U extends Component.T[] = Component.T[]> = Type<U>

export let is_superset = (a: Type, b: Type): boolean => {
  // This type is a void type.
  if (a.vec_ids.length === 0) {
    return false
  }
  // Compared type is a void type.
  if (b.vec_ids.length === 0) {
    return true
  }
  // Compared type is equivalent to this type.
  if (a.hash === b.hash) {
    return false
  }
  let ia = 0
  let ib = 0
  while (ia < a.vec_ids.length && ib < b.vec_ids.length) {
    let ida = a.vec_ids[ia]
    let idb = b.vec_ids[ib]
    if (ida < idb) {
      ia++
    } else if (ida > idb) {
      return false
    } else {
      ia++
      ib++
    }
  }
  return ib === b.vec_ids.length
}

export let is_left = (a: Type, b: Type): boolean => {
  let ia = 0
  let ib = 0
  while (ia < a.vec_ids.length && ib < b.vec_ids.length) {
    let ida = a.vec_ids[ia]
    let idb = b.vec_ids[ib]
    if (ida < idb) {
      ib++
    } else if (ida > idb) {
      return false
    } else {
      ia++
      ib++
    }
  }
  return true
}

export let xor_hash = (a: Type, b: Type): number => {
  if (a.hash === b.hash) return 0
  let xor = 0
  let ia = 0
  let ib = 0
  while (ia < a.vec_ids.length && ib < b.vec_ids.length) {
    let ida = a.vec_ids[ia]
    let idb = b.vec_ids[ib]
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
  while (ia < a.vec_ids.length) {
    xor = Hash.hash_word(xor, a.vec_ids[ia])
    ia++
  }
  while (ib < b.vec_ids.length) {
    xor = Hash.hash_word(xor, b.vec_ids[ib])
    ib++
  }
  return xor
}

export let xor_hash_u = (a: Type, b: Type): number => {
  return xor_hash(a, b) >>> 0
}

export let intersection = <U extends Component.T[], V extends Component.T[]>(
  a: Type<U>,
  b: Type<V>,
) => {
  let components: Component.T[] = []
  for (let i = 0; i < a.vec.length; i++) {
    let component = a.vec[i]
    if (b.sparse[component.id] !== undefined) {
      components.push(component)
    }
  }
  return from(components)
}

let with_ = <U extends Component.T[], V extends Component.T[]>(
  a: T<U>,
  b: T<V>,
): T<[...U, ...V]> => from(a.def.concat(b.def as Component.T[]))
export {with_ as with}

export let without = <U extends Component.T[], V extends Component.T[]>(
  a: T<U>,
  b: T<V>,
): T<[...U, ...V]> => {
  let components: Component.T[] = []
  for (let i = 0; i < a.vec.length; i++) {
    let component = a.vec[i]
    if (b.sparse[component.id] === undefined) {
      components.push(component)
    } else if (
      Component.is_relation(component) &&
      b.pair_counts[component.id] < a.pair_counts[component.id]
    ) {
      components.push(component)
    }
  }
  return from(components)
}

export let with_component = <U extends Component.T[], V extends Component.T>(
  type: T<U>,
  component: V,
): T<[...U, V]> => from(type.def.concat(component))

export let without_component = <U extends Component.T[], V extends Component.T>(
  type: T<U>,
  component: V,
): T<ExcludeFromTuple<U, V>> =>
  from(type.def.filter(c => c.id !== component.id))

export let is_type = (obj: object): obj is Type => obj instanceof Type

let normalize = <U extends (Type | Component.T)[]>(types: U): Normalized<U> => {
  let matched = new Set<number>()
  let components = [] as Component.T[]
  for (let i = 0; i < types.length; i++) {
    let type = types[i]
    if (is_type(type)) {
      for (let j = 0; j < type.def.length; j++) {
        let component = type.def[j]
        if (matched.has(component.id)) {
          continue
        }
        matched.add(component.id)
        components.push(component)
      }
    } else {
      if (matched.has(type.id)) {
        continue
      }
      matched.add(type.id)
      components.push(type)
    }
  }
  return components as Normalized<U>
}

export let has = (a: Type, b: Type): boolean => {
  for (let i = 0; i < b.vec_ids.length; i++) {
    let component_id = b.vec_ids[i]
    if (a.sparse[component_id] === undefined) {
      return false
    }
  }
  return true
}

export let has_component_id = (type: Type, component_id: number): boolean => {
  return type.sparse[component_id] !== undefined
}

export let has_component = (type: Type, component: Component.T): boolean => {
  return type.sparse[component.id] !== undefined
}

export let component_at = <U extends Component.T[], I extends number = 0>(
  type: Type<U>,
  index: I,
): U[I] => {
  const component = type.def[index] as U[I]
  Assert.ok(component !== undefined)
  return component
}

export let from = <U extends (Component.T | Type)[]>(
  types: U,
): Type<Normalized<U>> => new Type(normalize(types))

export let make = <U extends (Component.T | Type)[]>(
  ...types: U
): Type<Normalized<U>> => {
  return from(types)
}
