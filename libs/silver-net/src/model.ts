import {Component, Type, Unitary} from "silver-ecs"

class Model {
  iso_components
  iso_types
  to_iso_component

  constructor(types: Unitary[]) {
    this.iso_components = [] as Component[]
    this.iso_types = [] as Type[]
    this.to_iso_component = [] as number[]
    for (let i = 0; i < types.length; i++) {
      let type = types[i]
      this.add_component(type)
    }
  }

  add_component(type: Unitary) {
    let component = type.components[0]
    this.to_iso_component[component.id] =
      this.iso_components.push(component) - 1
    return this
  }
}
export type T = Model

export let make = (...types: Unitary[]) => {
  return new Model(types)
}
