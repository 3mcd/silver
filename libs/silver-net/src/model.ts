import {Component, Type, Unitary} from "silver-ecs"

class Model {
  iso
  isoType
  toIso

  constructor(types: Unitary[]) {
    this.iso = [] as Component[]
    this.isoType = [] as Type[]
    this.toIso = [] as number[]
    for (let i = 0; i < types.length; i++) {
      let type = types[i]
      this.add(type)
    }
  }

  add(type: Unitary) {
    let component = type.components[0]
    this.toIso[component.id] = this.iso.push(component) - 1
    return this
  }
}
export type T = Model

export let make = (...types: Unitary[]) => {
  return new Model(types)
}
