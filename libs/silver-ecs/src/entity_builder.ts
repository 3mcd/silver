import * as Component from "./component"
import * as World from "./world"
import * as Type from "./type"

export class EntityBuilder {
  #type: Type.T
  #values: unknown[] = []
  #world: World.T

  constructor(world: World.T) {
    this.#type = Type.empty
    this.#world = world
  }

  with<U extends Component.Tag | Component.Pair>(component: U): T
  with<U extends Component.Ref>(ref: U, value: Component.ValueOf<U>): T
  with(component: Component.T, value?: unknown) {
    this.#type = this.#type.with_component(component)
    if (Component.is_ref(component)) {
      this.#values[component.id] = value
    }
    return this
  }

  spawn() {
    return this.#world.spawn(this.#type, this.#values)
  }
}
export type T = EntityBuilder

export let make = (world: World.T) => {
  return new EntityBuilder(world)
}
