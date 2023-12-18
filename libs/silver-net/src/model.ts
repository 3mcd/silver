import {Component} from "silver-ecs"

class Model {
  iso
  toIso

  constructor() {
    this.iso = [] as Component[]
    this.toIso = [] as number[]
  }

  add(component: Component) {
    this.toIso[component.id] = this.iso.push(component) - 1
  }
}
export type T = Model

export let make = () => {
  return new Model()
}
