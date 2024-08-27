import * as Component from "./component"
import * as Type from "./type"
import * as World from "./world"

export class EntityBuilder<U extends Component.T[] = Component.T[]> {
  #type: Type.T<U>
  #values: unknown[] = []
  #world: World.T

  constructor(world: World.T, type: Type.T<U>, init: Component.ValuesOf<U>) {
    this.#type = type
    this.#world = world
    for (let i = 0; i < init.length; i++) {
      this.#values.push(init[i])
    }
  }

  with<U extends Component.Tag>(component: U): T
  with<U extends Component.Ref>(ref: U, value: Component.ValueOf<U>): T
  with<U extends Component.Pair>(component: U): T
  with(component: Component.T, value?: unknown) {
    this.#type = Type.make(this.#type, component) as unknown as Type.T<U>
    if (Component.is_ref(component)) {
      this.#values.push(value)
    }
    return this
  }

  spawn() {
    return this.#world.spawn(
      this.#type,
      ...(this.#values as Component.ValuesOf<U>),
    )
  }
}
export type T = EntityBuilder

export let make = <U extends Component.T[]>(
  world: World.T,
  type: Type.T<U>,
  values: Component.ValuesOf<U>,
) => {
  return new EntityBuilder(world, type, values)
}
