import * as Entity from "../entity/entity"
import * as Hash from "../hash"
import {ExcludeFromTuple} from "../types"
import * as Component from "./component"

type Spec<
  U extends Array<Type | Component.T>,
  Out extends Component.T[] = [],
> = U extends []
  ? Out
  : U extends [infer Head, ...infer Tail]
  ? Tail extends Array<Type | Component.T>
    ? Spec<
        Tail,
        Head extends Type<infer V>
          ? [...Out, ...Spec<V>]
          : Head extends Component.T
          ? [...Out, Head]
          : never
      >
    : never
  : never

export type Unitary<U extends Component.T = Component.T> = Type<[U]>

export const is_superset = (type_a: Type, type_b: Type): boolean => {
  // This type is a void type.
  if (type_a.component_ids.length === 0) return false
  // Compared type is a void type.
  if (type_b.component_ids.length === 0) return true
  // Compared type is equivalent to this type.
  if (type_a.hash === type_b.hash) return false
  let cursor_a = 0
  let cursor_b = 0
  while (
    cursor_a < type_a.component_ids.length &&
    cursor_b < type_b.component_ids.length
  ) {
    const component_id_a = type_a.component_ids[cursor_a]
    const component_id_b = type_b.component_ids[cursor_b]
    if (component_id_a < component_id_b) {
      cursor_a++
    } else if (component_id_a > component_id_b) {
      return false
    } else {
      cursor_a++
      cursor_b++
    }
  }
  return cursor_b === type_b.component_ids.length
}

export const superset_may_contain = (type_a: Type, type_b: Type): boolean => {
  let cursor_a = 0
  let cursor_b = 0
  while (
    cursor_a < type_a.component_ids.length &&
    cursor_b < type_b.component_ids.length
  ) {
    const component_id_a = type_a.component_ids[cursor_a]
    const component_id_b = type_b.component_ids[cursor_b]
    if (component_id_a < component_id_b) {
      cursor_b++
    } else if (component_id_a > component_id_b) {
      return false
    } else {
      cursor_a++
      cursor_b++
    }
  }
  return true
}

export const xor = (type_a: Type, type_b: Type): number => {
  if (type_a.hash === type_b.hash) return 0
  let xor = 0
  let cursor_a = 0
  let cursor_b = 0
  while (
    cursor_a < type_a.component_ids.length &&
    cursor_b < type_b.component_ids.length
  ) {
    const component_id_a = type_a.component_ids[cursor_a]
    const component_id_b = type_b.component_ids[cursor_b]
    if (component_id_a === component_id_b) {
      cursor_a++
      cursor_b++
    } else if (component_id_a < component_id_b) {
      xor = Hash.word(xor, component_id_a)
      cursor_a++
    } else if (component_id_a > component_id_b) {
      xor = Hash.word(xor, component_id_b)
      cursor_b++
    }
  }
  while (cursor_a < type_a.component_ids.length) {
    xor = Hash.word(xor, type_a.component_ids[cursor_a])
    cursor_a++
  }
  while (cursor_b < type_b.component_ids.length) {
    xor = Hash.word(xor, type_b.component_ids[cursor_b])
    cursor_b++
  }
  return xor
}

const with_ = <U extends Component.T[], V extends Component.T[]>(
  type_a: Type<U>,
  type_b: Type<V>,
): Type<[...U, ...V]> => {
  const components = type_a.component_spec.concat(
    type_b.component_spec as Component.T[],
  )
  return make(...components)
}
export {with_ as with}

export const without = <U extends Component.T[], V extends Component.T[]>(
  type_a: Type<U>,
  type_b: Type<V>,
): Type<[...U, ...V]> => {
  const components = type_a.component_spec.filter(
    component => type_b.sparse[component.id] === undefined,
  )
  return make(...components)
}

export const with_component = <U extends Component.T[], V extends Component.T>(
  type: Type<U>,
  component: V,
): Type<[...U, V]> => {
  const components = type.component_spec.concat(component)
  return make(...components)
}

export const without_component = <
  U extends Component.T[],
  V extends Component.T,
>(
  type: Type<U>,
  component: V,
): Type<ExcludeFromTuple<U, V>> => {
  const components = type.component_spec.filter(
    type_component => type_component.id !== component.id,
  )
  return make(...components)
}

const is_type = (obj: unknown): obj is Type =>
  typeof obj === "object" && obj !== null && "components" in obj

const sort_spec = (components: Component.T[]) =>
  components.sort((component_a, component_b) => component_a.id - component_b.id)

const make_spec = <U extends Array<Type | Component.T>>(types: U): Spec<U> => {
  const components = [] as Component.T[]
  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    if (is_type(type)) {
      for (let j = 0; j < type.component_spec.length; j++) {
        const component = type.component_spec[j]
        components.push(component)
      }
    } else {
      components.push(type)
    }
  }
  return components as Spec<U>
}

export const has = (type_a: Type, type_b: Type): boolean => {
  for (let i = 0; i < type_b.component_ids.length; i++) {
    const component_id = type_b.component_ids[i]
    if (type_a.sparse[component_id] === undefined) {
      return false
    }
  }
  return true
}

export class Type<U extends Component.T[] = Component.T[]> {
  component_ids
  component_spec
  components
  hash
  relations
  relationships
  sparse
  sparse_init
  sparse_relations

  constructor(component_spec: U) {
    const components = sort_spec(component_spec.slice())
    const sparse: number[] = []
    const sparse_init: number[] = []
    const sparse_relations: number[] = []
    for (let i = 0; i < components.length; i++) {
      const component = components[i]
      sparse[component.id] = i
    }
    let j = 0
    for (let i = 0; i < component_spec.length; i++) {
      const component = component_spec[i]
      if (Component.is_value(component) || Component.is_relation(component)) {
        sparse_init[component.id] = j++
      }
    }
    j = 0
    for (let i = 0; i < component_spec.length; i++) {
      const component = component_spec[i]
      if (Component.is_relation(component)) {
        sparse_relations[component.id] = j++
      }
    }
    this.component_ids = components.map(component => component.id)
    this.components = components
    this.hash = Hash.words(this.component_ids)
    this.component_spec = component_spec
    this.relations = components.filter(Component.is_relation)
    this.relationships = components.filter(Component.is_relationship)
    this.sparse = sparse
    this.sparse_init = sparse_init
    this.sparse_relations = sparse_relations
  }
}

export type T<U extends Component.T[] = Component.T[]> = Type<U>

export const make = <U extends Array<Component.T | Type>>(
  ...types: U
): Type<Spec<U>> => {
  return new Type(make_spec(types))
}

export const with_relationships = (type: T, values: unknown[]) => {
  let relationship_type = type
  for (let i = 0; i < type.relations.length; i++) {
    const relation = type.relations[i]
    const relationship_init_index = type.sparse_init[relation.id]
    const relationship_init = Component.is_value(relation)
      ? (values[relationship_init_index] as [Entity.T, unknown])[0]
      : (values[relationship_init_index] as Entity.T)
    relationship_type = with_component(
      relationship_type,
      Component.make_relationship(relation, relationship_init),
    )
  }
  return relationship_type
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")
  const A = Component.value()
  const B = Component.value()
  const C = Component.value()
  const D = Component.value()
  describe("type", () => {
    it("makes a sorted version of a type's components", () => {
      const type = make(A, C, B)
      expect(type.component_ids).toEqual([
        A.component_ids[0],
        B.component_ids[0],
        C.component_ids[0],
      ])
    })
    it("can be defined with other types", () => {
      const AB = make(A, B)
      const CD = make(C, D)
      expect(with_(AB, CD)).toEqual(make(A, B, C, D))
    })
    it("can compute a hash of the symmetric difference between two types", () => {
      const AB = make(A, B)
      const BC = make(B, C)
      expect(xor(AB, BC)).toEqual(xor(BC, AB))
    })
    it("determines if a type is a superset of another", () => {
      const AB = make(A, B)
      const ABC = make(A, B, C)
      expect(is_superset(ABC, AB)).toBe(true)
      expect(is_superset(AB, ABC)).toBe(false)
    })
    it("determines if a superset of a type could contain another", () => {
      const AC = make(A, C)
      const ABC = make(A, B, C)
      const CD = make(C, D)
      expect(superset_may_contain(AC, ABC)).toBe(false)
      expect(superset_may_contain(AC, CD)).toBe(true)
      expect(superset_may_contain(CD, A)).toBe(false)
      expect(superset_may_contain(ABC, D)).toBe(true)
      expect(superset_may_contain(ABC, AC)).toBe(true)
      expect(superset_may_contain(ABC, CD)).toBe(true)
      expect(superset_may_contain(D, ABC)).toBe(false)
    })
  })
}
