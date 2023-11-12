import * as Hash from "../hash"
import {ExcludeFromTuple} from "../types"
import * as Commands from "../world/commands"
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

export let is_superset = (type_a: Type, type_b: Type): boolean => {
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
    let component_id_a = type_a.component_ids[cursor_a]
    let component_id_b = type_b.component_ids[cursor_b]
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

export let superset_may_contain = (type_a: Type, type_b: Type): boolean => {
  let cursor_a = 0
  let cursor_b = 0
  while (
    cursor_a < type_a.component_ids.length &&
    cursor_b < type_b.component_ids.length
  ) {
    let component_id_a = type_a.component_ids[cursor_a]
    let component_id_b = type_b.component_ids[cursor_b]
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

export let xor = (type_a: Type, type_b: Type): number => {
  if (type_a.hash === type_b.hash) return 0
  let xor = 0
  let cursor_a = 0
  let cursor_b = 0
  while (
    cursor_a < type_a.component_ids.length &&
    cursor_b < type_b.component_ids.length
  ) {
    let component_id_a = type_a.component_ids[cursor_a]
    let component_id_b = type_b.component_ids[cursor_b]
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

let with_ = <U extends Component.T[], V extends Component.T[]>(
  type_a: Type<U>,
  type_b: Type<V>,
): Type<[...U, ...V]> => {
  let components = type_a.component_spec.concat(
    type_b.component_spec as Component.T[],
  )
  return from(components)
}
export {with_ as with}

export let without = <U extends Component.T[], V extends Component.T[]>(
  type_a: Type<U>,
  type_b: Type<V>,
): Type<[...U, ...V]> => {
  let components = type_a.component_spec.filter(
    component => type_b.sparse[component.id] === undefined,
  )
  return from(components)
}

export let with_component = <U extends Component.T[], V extends Component.T>(
  type: Type<U>,
  component: V,
): Type<[...U, V]> => {
  let components = type.component_spec.concat(component)
  return from(components)
}

export let without_component = <U extends Component.T[], V extends Component.T>(
  type: Type<U>,
  component: V,
): Type<ExcludeFromTuple<U, V>> => {
  let components = type.component_spec.filter(
    type_component => type_component.id !== component.id,
  )
  return from(components)
}

let is_type = (obj: object): obj is Type => "components" in obj

let sort_spec = (components: Component.T[]) =>
  components.sort((component_a, component_b) => component_a.id - component_b.id)

let make_spec = <U extends Array<Type | Component.T>>(types: U): Spec<U> => {
  let components = [] as Component.T[]
  for (let i = 0; i < types.length; i++) {
    let type = types[i]
    if (is_type(type)) {
      for (let j = 0; j < type.component_spec.length; j++) {
        let component = type.component_spec[j]
        components.push(component)
      }
    } else {
      components.push(type)
    }
  }
  return components as Spec<U>
}

export let has = (type_a: Type, type_b: Type): boolean => {
  for (let i = 0; i < type_b.component_ids.length; i++) {
    let component_id = type_b.component_ids[i]
    if (type_a.sparse[component_id] === undefined) {
      return false
    }
  }
  return true
}

export let has_id = (type: Type, component_id: number): boolean => {
  return type.sparse[component_id] !== undefined
}

let has_component = (type: Type, component: Component.T): boolean => {
  return type.sparse[component.id] !== undefined
}

export let has_relations = (type: Type): boolean => {
  return type.relations.length > 0
}

export let component_at = <U extends Component.T[], I extends number = 0>(
  type: Type<U>,
  index: I = 0 as I,
): U[I] => {
  return type.component_spec[index] as U[I]
}

export class Type<U extends Component.T[] = Component.T[]> {
  component_ids
  component_spec
  components
  hash
  relations
  relations_spec
  relationships
  sparse

  constructor(component_spec: U) {
    let components = sort_spec(component_spec.slice())
    this.component_ids = components.map(component => component.id)
    this.components = components
    this.hash = Hash.words(this.component_ids)
    this.component_spec = component_spec
    this.relations = components.filter(Component.is_relation)
    this.relations_spec = component_spec.filter(Component.is_relation)
    this.relationships = components.filter(Component.is_relationship)
    this.sparse = []
    for (let i = 0; i < components.length; i++) {
      let component = components[i]
      if (Component.is_relation(component) && has_component(this, component)) {
        if (component.topology === Component.Topology.Exclusive) {
          throw new Error(
            `Failed to construct type: type has multiple parents for hierarchical relation`,
          )
        }
      }
      this.sparse[component.id] = i
    }
  }
}

export type T<U extends Component.T[] = Component.T[]> = Type<U>

let from = <U extends Array<Component.T | Type>>(types: U): Type<Spec<U>> => {
  return new Type(make_spec(types))
}

export let make = <U extends Array<Component.T | Type>>(
  ...types: U
): Type<Spec<U>> => {
  return from(types)
}

export let with_relationships = (type: T, init: unknown[]): T => {
  let relationship_type = type
  let j = 0
  for (let i = 0; i < type.component_spec.length; i++) {
    let relation = type.component_spec[i]
    if (Component.is_relation(relation)) {
      let relation_init = init[j] as
        | Commands.InitTagRelation
        | Commands.InitValueRelation
      let relationship = Component.make_relationship(
        relation,
        typeof relation_init === "number" ? relation_init : relation_init[0],
      )
      relationship_type = with_component(relationship_type, relationship)
      j++
    } else if (Component.stores_value(relation)) {
      j++
    }
  }
  return relationship_type
}
