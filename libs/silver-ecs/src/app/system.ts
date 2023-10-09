import * as World from "../world/world"

type System = (world: World.T) => () => void

const systems = new Map<System, ReturnType<System>>()

export const run = (
  world: World.T,
  system: (world: World.T) => () => void,
): void => {
  let impl = systems.get(system)
  if (impl === undefined) {
    impl = system(world)
    systems.set(system, impl)
  }
  impl()
}
