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

export const isSuperset = (typeA: Type, typeB: Type): boolean => {
  // This type is a void type.
  if (typeA.componentIds.length === 0) return false
  // Compared type is a void type.
  if (typeB.componentIds.length === 0) return true
  // Compared type is equivalent to this type.
  if (typeA.componentsHash === typeB.componentsHash) return false
  let cursorA = 0
  let cursorB = 0
  while (
    cursorA < typeA.componentIds.length &&
    cursorB < typeB.componentIds.length
  ) {
    const componentIdA = typeA.componentIds[cursorA]
    const componentIdB = typeB.componentIds[cursorB]
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

export const supersetMayContain = (typeA: Type, typeB: Type): boolean => {
  let cursorA = 0
  let cursorB = 0
  while (
    cursorA < typeA.componentIds.length &&
    cursorB < typeB.componentIds.length
  ) {
    const componentIdA = typeA.componentIds[cursorA]
    const componentIdB = typeB.componentIds[cursorB]
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

export const xor = (typeA: Type, typeB: Type): number => {
  if (typeA.componentsHash === typeB.componentsHash) return 0
  let xor = 0
  let cursorA = 0
  let cursorB = 0
  while (
    cursorA < typeA.componentIds.length &&
    cursorB < typeB.componentIds.length
  ) {
    const componentIdA = typeA.componentIds[cursorA]
    const componentIdB = typeB.componentIds[cursorB]
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

const with_ = <U extends Component.T[], V extends Component.T[]>(
  typeA: Type<U>,
  typeB: Type<V>,
): Type<[...U, ...V]> => {
  const components = typeA.componentSpec.concat(
    typeB.componentSpec as Component.T[],
  )
  return make(...components)
}
export {with_ as with}

export const without = <U extends Component.T[], V extends Component.T[]>(
  typeA: Type<U>,
  typeB: Type<V>,
): Type<[...U, ...V]> => {
  const components = typeA.componentSpec.filter(
    component => typeB.sparse[component.id] === undefined,
  )
  return make(...components)
}

export const withComponent = <U extends Component.T[], V extends Component.T>(
  type: Type<U>,
  component: V,
): Type<[...U, V]> => {
  const components = type.componentSpec.concat(component)
  return make(...components)
}

export const withoutComponent = <
  U extends Component.T[],
  V extends Component.T,
>(
  type: Type<U>,
  component: V,
): Type<ExcludeFromTuple<U, V>> => {
  const components = type.componentSpec.filter(
    typeComponent => typeComponent.id !== component.id,
  )
  return make(...components)
}

const isType = (obj: unknown): obj is Type =>
  typeof obj === "object" && obj !== null && "components" in obj

const sortSpec = (components: Component.T[]) =>
  components.sort((componentA, componentB) => componentA.id - componentB.id)

const makeSpec = <U extends Array<Type | Component.T>>(types: U): Spec<U> => {
  const components = [] as Component.T[]
  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    if (isType(type)) {
      for (let j = 0; j < type.componentSpec.length; j++) {
        const component = type.componentSpec[j]
        components.push(component)
      }
    } else {
      components.push(type)
    }
  }
  return components as Spec<U>
}

export const has = (typeA: Type, typeB: Type): boolean => {
  for (let i = 0; i < typeB.componentIds.length; i++) {
    const componentId = typeB.componentIds[i]
    if (typeA.sparse[componentId] === undefined) {
      return false
    }
  }
  return true
}

export class Type<U extends Component.T[] = Component.T[]> {
  componentIds
  componentSpec
  components
  componentsHash
  relations
  relationships
  sparse
  sparseInit

  constructor(componentSpec: U) {
    const components = sortSpec(componentSpec.slice())
    const sparse: number[] = []
    const sparseInit: number[] = []
    for (let i = 0; i < components.length; i++) {
      const component = components[i]
      sparse[component.id] = i
    }
    let j = 0
    for (let i = 0; i < componentSpec.length; i++) {
      const component = componentSpec[i]
      if (Component.isValue(component) || Component.isRelation(component)) {
        sparseInit[component.id] = j++
      }
    }
    this.componentIds = components.map(component => component.id)
    this.components = components
    this.componentsHash = Hash.words(this.componentIds)
    this.componentSpec = componentSpec
    this.relations = components.filter(Component.isRelation)
    this.relationships = components.filter(Component.isRelationship)
    this.sparse = sparse
    this.sparseInit = sparseInit
  }
}

export type T<U extends Component.T[] = Component.T[]> = Type<U>

export const make = <U extends Array<Component.T | Type>>(
  ...types: U
): Type<Spec<U>> => {
  return new Type(makeSpec(types))
}

export const hydrateRelationships = (type: T, values: unknown[]) => {
  let relationshipType = type
  for (let i = 0; i < type.relations.length; i++) {
    const relation = type.relations[i]
    const relationshipInitIndex = type.sparseInit[relation.id]
    const relationshipInit = Component.isValue(relation)
      ? (values[relationshipInitIndex] as [Entity.T, unknown])[0]
      : (values[relationshipInitIndex] as Entity.T)
    relationshipType = withComponent(
      relationshipType,
      Component.makeRelationship(relation, relationshipInit),
    )
  }
  return relationshipType
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
      expect(type.componentIds).toEqual([
        A.componentIds[0],
        B.componentIds[0],
        C.componentIds[0],
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
      expect(isSuperset(ABC, AB)).toBe(true)
      expect(isSuperset(AB, ABC)).toBe(false)
    })
    it("determines if a superset of a type could contain another", () => {
      const AC = make(A, C)
      const ABC = make(A, B, C)
      const CD = make(C, D)
      expect(supersetMayContain(AC, ABC)).toBe(false)
      expect(supersetMayContain(AC, CD)).toBe(true)
      expect(supersetMayContain(CD, A)).toBe(false)
      expect(supersetMayContain(ABC, D)).toBe(true)
      expect(supersetMayContain(ABC, AC)).toBe(true)
      expect(supersetMayContain(ABC, CD)).toBe(true)
      expect(supersetMayContain(D, ABC)).toBe(false)
    })
  })
}
