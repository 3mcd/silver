import * as Entity from "../entity/entity"
import * as Hash from "../hash"
import {ExcludeFromTuple} from "../types"
import * as Commands from "../world/commands"
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

export let isSuperset = (a: Type, b: Type): boolean => {
  // This type is a void type.
  if (a.ids.length === 0) return false
  // Compared type is a void type.
  if (b.ids.length === 0) return true
  // Compared type is equivalent to this type.
  if (a.hash === b.hash) return false
  let ia = 0
  let ib = 0
  while (ia < a.ids.length && ib < b.ids.length) {
    let ida = a.ids[ia]
    let idb = b.ids[ib]
    if (ida < idb) {
      ia++
    } else if (ida > idb) {
      return false
    } else {
      ia++
      ib++
    }
  }
  return ib === b.ids.length
}

export let supersetMayContain = (a: Type, b: Type): boolean => {
  let ia = 0
  let ib = 0
  while (ia < a.ids.length && ib < b.ids.length) {
    let ida = a.ids[ia]
    let idb = b.ids[ib]
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

export let xor = (a: Type, b: Type): number => {
  if (a.hash === b.hash) return 0
  let xor = 0
  let ia = 0
  let ib = 0
  while (ia < a.ids.length && ib < b.ids.length) {
    let ida = a.ids[ia]
    let idb = b.ids[ib]
    if (ida === idb) {
      ia++
      ib++
    } else if (ida < idb) {
      xor = Hash.word(xor, ida)
      ia++
    } else if (ida > idb) {
      xor = Hash.word(xor, idb)
      ib++
    }
  }
  while (ia < a.ids.length) {
    xor = Hash.word(xor, a.ids[ia])
    ia++
  }
  while (ib < b.ids.length) {
    xor = Hash.word(xor, b.ids[ib])
    ib++
  }
  return xor
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
      b.pairCounts[component.id] < a.pairCounts[component.id]
    ) {
      components.push(component)
    }
  }
  return from(components)
}

export let withComponent = <U extends Component.T[], V extends Component.T>(
  type: T<U>,
  component: V,
): T<[...U, V]> => from(type.components.concat(component))

export let withoutComponent = <U extends Component.T[], V extends Component.T>(
  type: T<U>,
  component: V,
): T<ExcludeFromTuple<U, V>> =>
  from(type.components.filter(c => c.id !== component.id))

let isType = (obj: object): obj is Type => "components" in obj

let normalize = <U extends (Type | Component.T)[]>(types: U): Normalized<U> => {
  let matched = new Set<Component.T>()
  let components = [] as Component.T[]
  for (let i = 0; i < types.length; i++) {
    let type = types[i]
    if (isType(type)) {
      for (let j = 0; j < type.components.length; j++) {
        let component = type.components[j]
        if (matched.has(component)) {
          continue
        }
        matched.add(component)
        components.push(component)
      }
    } else {
      if (matched.has(type)) {
        continue
      }
      matched.add(type)
      components.push(type)
    }
  }
  return components as Normalized<U>
}

export let has = (a: Type, b: Type): boolean => {
  for (let i = 0; i < b.ids.length; i++) {
    let componentId = b.ids[i]
    if (a.sparse[componentId] === undefined) {
      return false
    }
  }
  return true
}

export let hasId = (type: Type, componentId: number): boolean => {
  return type.sparse[componentId] !== undefined
}

export let hasComponent = (type: Type, component: Component.T): boolean => {
  return type.sparse[component.id] !== undefined
}

export let componentAt = <U extends Component.T[], I extends number = 0>(
  type: Type<U>,
  index: I,
): U[I] => {
  return type.components[index] as U[I]
}

export enum Kind {
  Default,
  Unpaired,
  Paired,
}

let makeSparse = (components: Component.T[]): number[] => {
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
  ids
  components
  ordered
  hash
  kind
  pairs
  pairCounts
  relations
  sparse

  constructor(components: U) {
    let ordered = components.slice().sort((a, b) => a.id - b.id)
    this.sparse = makeSparse(components)
    this.ids = ordered.map(component => component.id)
    this.ordered = ordered
    this.components = components
    this.hash = Hash.words(this.ids)
    this.relations = components.filter(Component.isRelation)
    this.pairCounts = [] as number[]
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
        let pairRelationId = Entity.parseHi(pair.id)
        if (pairRelationId === relation.id) {
          this.pairCounts[relation.id] = (this.pairCounts[relation.id] || 0) + 1
        }
      }
    }
  }

  make(
    init?: U[0] extends Component.Value<infer V> ? Partial<V> : never,
  ): U[0] extends Component.Value<infer V> ? V : never {
    let component = this.components[0]
    if (Component.isValue(component) && component.schema !== undefined) {
      let value = Schema.initialize(
        component.schema,
      ) as U[0] extends Component.Value<infer V> ? V : never
      if (component.initializer === undefined) {
        return value
      }
      return component.initializer(
        typeof component.schema === "object"
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

export let from = <U extends (Component.T | Type)[]>(
  types: U,
): Type<Normalized<U>> => new Type(normalize(types))

export let make = <U extends (Component.T | Type)[]>(
  ...types: U
): Type<Normalized<U>> => from(types)

export let pair = (type: T, values: unknown[]): T => {
  let j = 0
  for (let i = 0; i < type.components.length; i++) {
    let relation = type.components[i]
    if (Component.isRelation(relation)) {
      let pairValue = values[j] as Commands.InitTagPair | Commands.InitValuePair
      let pair = Component.makePair(
        relation,
        typeof pairValue === "number" ? pairValue : pairValue[0],
      )
      type = withComponent(type, pair)
      j++
    } else if (Component.storesValue(relation)) {
      j++
    }
  }
  return type
}
