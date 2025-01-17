import * as Assert from "../assert"
import * as Component from "../component"
import * as World from "../world"

export let mock_world = () => {
  let resources = new Map<Component.Ref, unknown>()
  return {
    set_resource(res: Component.Ref, value: unknown) {
      resources.set(res, value)
      return this
    },
    get_resource(res: Component.Ref) {
      return Assert.assert_exists(resources.get(res))
    },
    get_resource_opt(res: Component.Ref) {
      return resources.get(res)
    },
    build() {
      return this as unknown as World.T
    },
  }
}
