import * as Entity from "../entity/entity"
import * as Hash from "../hash"
import {ExcludeFromTuple} from "../types"
import * as Commands from "../world/commands"
import * as Component from "./component"

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

export enum Kind {
  Default,
  Unpaired,
  Paired,
}

let make_sparse = (components: Component.T[]): number[] => {
  let sparse = []
  for (let i = 0; i < components.length; i++) {
    let component = components[i]
    if (
      Component.isRelation(component) &&
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
  component_ids
  components
  ordered
  hash
  kind
  pair_counts
  pairs
  relations
  sparse

  constructor(components: U) {
    let ordered = components.slice().sort((a, b) => a.id - b.id)
    this.sparse = make_sparse(components)
    this.component_ids = ordered.map(component => component.id)
    this.ordered = ordered
    this.components = components
    this.hash = Hash.hash_words(this.component_ids)
    this.relations = components.filter(Component.isRelation)
    this.pair_counts = [] as number[]
    this.pairs = ordered.filter(Component.isPair)
    this.kind =
      this.relations.length === 0
        ? Kind.Default
        : this.relations.length === this.pairs.length
        ? Kind.Paired
        : Kind.Unpaired
    for (let i = 0; i < this.relations.length; i++) {
      let relation = this.relations[i]
      for (let j = 0; j < this.pairs.length; j++) {
        let pair = this.pairs[j]
        let pair_relation_id = Entity.parseHi(pair.id)
        if (pair_relation_id === relation.id) {
          this.pair_counts[relation.id] =
            (this.pair_counts[relation.id] || 0) + 1
        }
      }
    }
  }
}
export type T<U extends Component.T[] = Component.T[]> = Type<U>

export let is_superset = (a: Type, b: Type): boolean => {
  // This type is a void type.
  if (a.component_ids.length === 0) return false
  // Compared type is a void type.
  if (b.component_ids.length === 0) return true
  // Compared type is equivalent to this type.
  if (a.hash === b.hash) return false
  let ia = 0
  let ib = 0
  while (ia < a.component_ids.length && ib < b.component_ids.length) {
    let ida = a.component_ids[ia]
    let idb = b.component_ids[ib]
    if (ida < idb) {
      ia++
    } else if (ida > idb) {
      return false
    } else {
      ia++
      ib++
    }
  }
  return ib === b.component_ids.length
}

export let is_left = (a: Type, b: Type): boolean => {
  let ia = 0
  let ib = 0
  while (ia < a.component_ids.length && ib < b.component_ids.length) {
    let ida = a.component_ids[ia]
    let idb = b.component_ids[ib]
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
  while (ia < a.component_ids.length && ib < b.component_ids.length) {
    let ida = a.component_ids[ia]
    let idb = b.component_ids[ib]
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
  while (ia < a.component_ids.length) {
    xor = Hash.hash_word(xor, a.component_ids[ia])
    ia++
  }
  while (ib < b.component_ids.length) {
    xor = Hash.hash_word(xor, b.component_ids[ib])
    ib++
  }
  return xor
}

export let intersection = <U extends Component.T[], V extends Component.T[]>(
  a: Type<U>,
  b: Type<V>,
) => {
  let components: Component.T[] = []
  for (let i = 0; i < a.ordered.length; i++) {
    let component = a.ordered[i]
    if (b.sparse[component.id] !== undefined) {
      components.push(component)
    }
  }
  return from(components)
}

let with_ = <U extends Component.T[], V extends Component.T[]>(
  a: T<U>,
  b: T<V>,
): T<[...U, ...V]> => from(a.components.concat(b.components as Component.T[]))
export {with_ as with}

export let without = <U extends Component.T[], V extends Component.T[]>(
  a: T<U>,
  b: T<V>,
): T<[...U, ...V]> => {
  let components: Component.T[] = []
  for (let i = 0; i < a.ordered.length; i++) {
    let component = a.ordered[i]
    if (b.sparse[component.id] === undefined) {
      components.push(component)
    } else if (
      Component.isRelation(component) &&
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
): T<[...U, V]> => from(type.components.concat(component))

export let without_component = <U extends Component.T[], V extends Component.T>(
  type: T<U>,
  component: V,
): T<ExcludeFromTuple<U, V>> =>
  from(type.components.filter(c => c.id !== component.id))

let isType = (obj: object): obj is Type => "components" in obj

let normalize = <U extends (Type | Component.T)[]>(types: U): Normalized<U> => {
  let matched = new Set<number>()
  let components = [] as Component.T[]
  for (let i = 0; i < types.length; i++) {
    let type = types[i]
    if (isType(type)) {
      for (let j = 0; j < type.components.length; j++) {
        let component = type.components[j]
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
  for (let i = 0; i < b.component_ids.length; i++) {
    let component_id = b.component_ids[i]
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
  return type.components[index] as U[I]
}

export let from = <U extends (Component.T | Type)[]>(
  types: U,
): Type<Normalized<U>> => new Type(normalize(types))

export let make = <U extends (Component.T | Type)[]>(
  ...types: U
): Type<Normalized<U>> => {
  return from(types)
}

export let pair = (type: T, values: unknown[]): T => {
  let j = 0
  for (let i = 0; i < type.components.length; i++) {
    let relation = type.components[i]
    if (Component.isRelation(relation)) {
      let pairValue = values[j] as Commands.InitTagPair | Commands.InitRefPair
      let pair = Component.makePair(
        relation,
        typeof pairValue === "number" ? pairValue : pairValue[0],
      )
      type = with_component(type, pair)
      j++
    } else if (Component.storesValue(relation)) {
      j++
    }
  }
  return type
}
