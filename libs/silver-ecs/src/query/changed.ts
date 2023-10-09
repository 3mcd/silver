import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as SparseMap from "../sparse/sparse_map"
import * as Changes from "../world/changes"

export class FilterState {
  changes
  stage

  constructor() {
    this.changes = Changes.make()
    this.stage = SparseMap.make<number>()
  }
}

export type Predicate = (entity: Entity.T) => boolean

export const makeFilterState = (): FilterState => {
  return new FilterState()
}

export const makeComponentChangedPredicate = (component: Component.T) => {
  const componentId = component.id
  // make the component+entity key
  let s = `const k${componentId}=((${componentId}&${Entity.HI})<<${Entity.LO_EXTENT})|(e&${Entity.LO});`
  // get the previous and next versions
  s += `const b${componentId}=B[k${componentId}];`
  // if the next version is undefined, the entity has not changed (or does not
  // have the component)
  s += `if(b${componentId}===undefined)return false;`
  s += `const a${componentId}=A[k${componentId}];`
  // if a version exists and is greater than or equal to the next version, the
  // entity has not changed
  s += `if(a${componentId}!==undefined&&a${componentId}>=b${componentId})return false;`
  // the entity has changed, so stage the new version
  s += `$(k${componentId},b${componentId});`
  return s
}

export const compilePredicate = (
  type: Type.T,
  changes: Changes.T,
  state: FilterState,
): Predicate => {
  const update = (key: number, version: number) =>
    SparseMap.set(state.stage, key, version)
  let body = "return function changed(e){"
  for (let i = 0; i < type.components.length; i++) {
    const component = type.components[i]
    body += makeComponentChangedPredicate(component)
  }
  body += "return true}"
  const closure = Function("A", "B", "$", body)
  return closure(state.changes, changes, update)
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")
  describe("changed", () => {
    it("returns true if the entity has changed", () => {
      const A = Component.tag()
      const state = makeFilterState()
      const changes = Changes.make()
      const changed = compilePredicate(A, changes, state)
      const entity = Entity.make(0, 0)
      const key = Entity.make(entity, A.components[0].id)
      expect(changed(entity)).to.be.false
      Changes.bump(changes, key)
      expect(changed(entity)).to.be.true
      expect(SparseMap.get(state.stage, key)).toBe(1)
    })
  })
}
