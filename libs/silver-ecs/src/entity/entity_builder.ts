import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Commands from "../world/commands"
import * as World from "../world/world"

export class EntityBuilder<U extends Component.T[] = Component.T[]> {
  #world: World.T
  #type: Type.T<U>
  #init: Commands.Init<U> = [] as Commands.Init<U>

  constructor(world: World.T, type: Type.T<U>, ...init: Commands.Init<U>) {
    this.#world = world
    this.#type = type
    for (let i = 0; i < init.length; i++) {
      this.#init.push(init[i])
    }
  }

  with<V extends Component.T[]>(
    type: Type.T<V>,
    ...values: Commands.Init<V>
  ): EntityBuilder<[...U, ...V]> {
    this.#type = Type.make(this.#type, type)
    let init = Commands.init(type, values)
    for (let i = 0; i < init.length; i++) {
      this.#init.push(init[i])
    }
    return this as unknown as EntityBuilder<[...U, ...V]>
  }

  spawn() {
    return this.#world.spawn(this.#type, ...this.#init)
  }
}
