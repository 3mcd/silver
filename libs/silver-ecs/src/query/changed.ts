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

export let make_filter_state = (): FilterState => {
  return new FilterState()
}

export let make_component_changed_predicate = (component: Component.T) => {
  let component_id = component.id
  // make the component+entity key
  let s = `let k${component_id}=((${component_id}&${Entity.HI})<<${Entity.LO_EXTENT})|(e&${Entity.LO});`
  // get the previous and next versions
  s += `let b${component_id}=B[k${component_id}];`
  // if the next version is undefined, the entity has not changed (or does not
  // have the component)
  s += `if(b${component_id}===undefined)return false;`
  s += `let a${component_id}=A[k${component_id}];`
  // if a version exists and is greater than or equal to the next version, the
  // entity has not changed
  s += `if(a${component_id}!==undefined&&a${component_id}>=b${component_id})return false;`
  // the entity has changed, so stage the new version
  s += `$(k${component_id},b${component_id});`
  return s
}

export let compile_predicate = (
  type: Type.T,
  changes: Changes.T,
  state: FilterState,
): Predicate => {
  let update = (key: number, version: number) =>
    SparseMap.set(state.stage, key, version)
  let body = "return function changed(e){"
  for (let i = 0; i < type.components.length; i++) {
    let component = type.components[i]
    body += make_component_changed_predicate(component)
  }
  body += "return true}"
  let closure = Function("A", "B", "$", body)
  return closure(state.changes, changes, update)
}

if (import.meta.vitest) {
  let {describe, it, expect} = await import("vitest")
  describe("changed", () => {
    it("returns true if the entity has changed", () => {
      let A = Component.tag()
      let state = make_filter_state()
      let changes = Changes.make()
      let changed = compile_predicate(A, changes, state)
      let entity = Entity.make(0, 0)
      expect(changed(entity)).to.be.false
      Changes.bump(changes, entity, A.components[0].id)
      expect(changed(entity)).to.be.true
    })
  })
}
