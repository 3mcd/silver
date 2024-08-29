import * as Component from "./component"
import * as Type from "./sig"
import * as Entity from "./entity"
import * as EntityVersions from "./entity_versions"
import * as SparseMap from "./sparse_map"

export type Predicate = (entity: Entity.T) => boolean

let make_component_changed_predicate = (component: Component.T) => {
  let componentId = component.id
  // make the component+entity key
  let s = `let k${componentId}=((${componentId}&${Entity.HI})<<${Entity.LO_EXTENT})|(e&${Entity.LO});`
  // get the previous and next versions
  s += `let b${componentId}=B[k${componentId}];`
  // if the next version is undefined, the entity has not changed (or does not
  // have the component)
  s += `if(b${componentId}===undefined)return false;`
  s += `let a${componentId}=A[k${componentId}];`
  // if a version exists and is greater than or equal to the next version, the
  // entity has not changed
  s += `if(a${componentId}!==undefined&&a${componentId}>=b${componentId})return false;`
  // the entity has changed, so stage the new version
  s += `S(k${componentId},b${componentId});`
  return s
}

export let compile_changed_predicate = (
  type: Type.T,
  local: EntityVersions.T,
  remote: EntityVersions.T,
  stage: SparseMap.T<number>,
): Predicate => {
  let update = (key: number, version: number) => {
    SparseMap.set(stage, key, version)
  }
  let body = "return function changed(e){"
  for (let i = 0; i < type.vec.length; i++) {
    let component = type.vec[i]
    body += make_component_changed_predicate(component)
  }
  body += "return true}"
  return Function("A", "B", "S", body)(local, remote, update)
}

export class Changed {
  a
  b
  stage
  predicate

  constructor(type: Type.T, b: EntityVersions.T) {
    this.a = EntityVersions.make()
    this.b = b
    this.stage = SparseMap.make<number>()
    this.predicate = compile_changed_predicate(type, this.a, this.b, this.stage)
  }
}
export type T = Changed

export let make = (type: Type.T, b: EntityVersions.T) => {
  return new Changed(type, b)
}
