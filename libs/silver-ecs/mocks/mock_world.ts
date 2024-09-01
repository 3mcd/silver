import * as Assert from "../src/assert"
import * as Component from "../src/component"
import * as World from "../src/world"

export let mock_world = () => {
  let resources = new Map<Component.Ref, unknown>()
  return {
    set_resource<U>(res: Component.Ref, value: unknown) {
      resources.set(res, value)
      return this
    },
    get_resource(res: Component.Ref) {
      return Assert.exists(resources.get(res) as U)
    },
    build() {
      return this as unknown as World.T
    },
  }
}
