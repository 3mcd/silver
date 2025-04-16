import * as Component from "./component.ts"
import * as World from "./world.ts"
import * as Type from "./type.ts"

export class EntityBuilder {
  #type: Type.t
  #values: unknown[] = []
  #world: World.t

  constructor(world: World.t) {
    this.#type = Type.empty
    this.#world = world
  }

  with<U extends Component.Tag | Component.Pair>(component: U): t
  with<U extends Component.Ref>(ref: U, value: Component.ValueOf<U>): t
  with(component: Component.t, value?: unknown) {
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
export type t = EntityBuilder

export let make = (world: World.t) => {
  return new EntityBuilder(world)
}
