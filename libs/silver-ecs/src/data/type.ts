import * as Hash from "../hash"
import {ExcludeFromTuple} from "../types"
import * as Commands from "../world/commands"
import * as Component from "./component"

export type Spec<
  U extends (Type | Component.T)[],
  Out extends Component.T[] = [],
> = U extends []
  ? Out
  : U extends [infer Head, ...infer Tail]
  ? Tail extends (Type | Component.T)[]
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

export let isSuperset = (typeA: Type, typeB: Type): boolean => {
  // This type is a void type.
  if (typeA.componentIds.length === 0) return false
  // Compared type is a void type.
  if (typeB.componentIds.length === 0) return true
  // Compared type is equivalent to this type.
  if (typeA.hash === typeB.hash) return false
  let cursorA = 0
  let cursorB = 0
  while (
    cursorA < typeA.componentIds.length &&
    cursorB < typeB.componentIds.length
  ) {
    let componentIdA = typeA.componentIds[cursorA]
    let componentIdB = typeB.componentIds[cursorB]
    if (componentIdA < componentIdB) {
      cursorA++
    } else if (componentIdA > componentIdB) {
      return false
    } else {
      cursorA++
      cursorB++
    }
  }
  return cursorB === typeB.componentIds.length
}

export let supersetMayContain = (typeA: Type, typeB: Type): boolean => {
  let cursorA = 0
  let cursorB = 0
  while (
    cursorA < typeA.componentIds.length &&
    cursorB < typeB.componentIds.length
  ) {
    let componentIdA = typeA.componentIds[cursorA]
    let componentIdB = typeB.componentIds[cursorB]
    if (componentIdA < componentIdB) {
      cursorB++
    } else if (componentIdA > componentIdB) {
      return false
    } else {
      cursorA++
      cursorB++
    }
  }
  return true
}

export let xor = (typeA: Type, typeB: Type): number => {
  if (typeA.hash === typeB.hash) return 0
  let xor = 0
  let cursorA = 0
  let cursorB = 0
  while (
    cursorA < typeA.componentIds.length &&
    cursorB < typeB.componentIds.length
  ) {
    let componentIdA = typeA.componentIds[cursorA]
    let componentIdB = typeB.componentIds[cursorB]
    if (componentIdA === componentIdB) {
      cursorA++
      cursorB++
    } else if (componentIdA < componentIdB) {
      xor = Hash.word(xor, componentIdA)
      cursorA++
    } else if (componentIdA > componentIdB) {
      xor = Hash.word(xor, componentIdB)
      cursorB++
    }
  }
  while (cursorA < typeA.componentIds.length) {
    xor = Hash.word(xor, typeA.componentIds[cursorA])
    cursorA++
  }
  while (cursorB < typeB.componentIds.length) {
    xor = Hash.word(xor, typeB.componentIds[cursorB])
    cursorB++
  }
  return xor
}

let with_ = <U extends Component.T[], V extends Component.T[]>(
  typeA: Type<U>,
  typeB: Type<V>,
): Type<[...U, ...V]> => {
  let components = typeA.componentSpec.concat(
    typeB.componentSpec as Component.T[],
  )
  return from(components)
}
export {with_ as with}

export let without = <U extends Component.T[], V extends Component.T[]>(
  typeA: Type<U>,
  typeB: Type<V>,
): Type<[...U, ...V]> => {
  let components = typeA.componentSpec.filter(
    component => typeB.sparse[component.id] === undefined,
  )
  return from(components)
}

export let withComponent = <U extends Component.T[], V extends Component.T>(
  type: Type<U>,
  component: V,
): Type<[...U, V]> => {
  let components = type.componentSpec.concat(component)
  return from(components)
}

export let withoutComponent = <U extends Component.T[], V extends Component.T>(
  type: Type<U>,
  component: V,
): Type<ExcludeFromTuple<U, V>> => {
  let components = type.componentSpec.filter(
    typeComponent => typeComponent.id !== component.id,
  )
  return from(components)
}

let isType = (obj: object): obj is Type => "components" in obj

let sortSpec = (components: Component.T[]) =>
  components.sort((componentA, componentB) => componentA.id - componentB.id)

let makeSpec = <U extends (Type | Component.T)[]>(types: U): Spec<U> => {
  let hits = new Set<Component.T>()
  let components = [] as Component.T[]
  for (let i = 0; i < types.length; i++) {
    let type = types[i]
    if (isType(type)) {
      for (let j = 0; j < type.componentSpec.length; j++) {
        let component = type.componentSpec[j]
        if (!Component.isRelation(component)) {
          if (hits.has(component)) {
            continue
          }
          hits.add(component)
        }
        components.push(component)
      }
    } else {
      if (!Component.isRelation(type)) {
        if (hits.has(type)) {
          continue
        }
        hits.add(type)
      }
      components.push(type)
    }
  }
  return components as Spec<U>
}

export let has = (typeA: Type, typeB: Type): boolean => {
  for (let i = 0; i < typeB.componentIds.length; i++) {
    let componentId = typeB.componentIds[i]
    if (typeA.sparse[componentId] === undefined) {
      return false
    }
  }
  return true
}

export let hasId = (type: Type, componentId: number): boolean => {
  return type.sparse[componentId] !== undefined
}

let hasComponent = (type: Type, component: Component.T): boolean => {
  return type.sparse[component.id] !== undefined
}

export let hasRelations = (type: Type): boolean => {
  return type.relations.length > 0
}

export let componentAt = <U extends Component.T[], I extends number = 0>(
  type: Type<U>,
  index: I = 0 as I,
): U[I] => {
  return type.componentSpec[index] as U[I]
}

export class Type<U extends Component.T[] = Component.T[]> {
  componentIds
  componentSpec
  components
  hash
  relations
  relationsSpec
  relationships
  sparse

  constructor(componentSpec: U) {
    let components = sortSpec(componentSpec.slice())
    this.componentIds = components.map(component => component.id)
    this.components = components
    this.hash = Hash.words(this.componentIds)
    this.componentSpec = componentSpec
    this.relations = components.filter(Component.isRelation)
    this.relationsSpec = componentSpec.filter(Component.isRelation)
    this.relationships = components.filter(Component.isRelationship)
    this.sparse = []
    for (let i = 0; i < components.length; i++) {
      let component = components[i]
      if (Component.isRelation(component) && hasComponent(this, component)) {
        if (component.topology === Component.Topology.Exclusive) {
          throw new Error(
            `Failed to construct type: type has multiple parents for hierarchical relation`,
          )
        }
      }
      this.sparse[component.id] = i
    }
  }

  toString() {
    return `Type(${this.componentIds.join(",")})`
  }
}

export type T<U extends Component.T[] = Component.T[]> = Type<U>

let from = <U extends (Component.T | Type)[]>(types: U): Type<Spec<U>> => {
  return new Type(makeSpec(types))
}

export let make = <U extends (Component.T | Type)[]>(
  ...types: U
): Type<Spec<U>> => {
  return from(types)
}

export let withRelationships = (type: T, init: unknown[]): T => {
  let relationshipType = type
  let j = 0
  for (let i = 0; i < type.componentSpec.length; i++) {
    let relation = type.componentSpec[i]
    if (Component.isRelation(relation)) {
      let relationInit = init[j] as
        | Commands.InitTagRelation
        | Commands.InitValueRelation
      let relationship = Component.makeRelationship(
        relation,
        typeof relationInit === "number" ? relationInit : relationInit[0],
      )
      relationshipType = withComponent(relationshipType, relationship)
      j++
    } else if (Component.storesValue(relation)) {
      j++
    }
  }
  return relationshipType
}
