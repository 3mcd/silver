import * as World from "../world/world"

type System = (world: World.T) => () => void

let systems = new Map<System, ReturnType<System>>()

export let run = (
  world: World.T,
  system: (world: World.T) => () => void,
): void => {
  let system_impl = systems.get(system)
  if (system_impl === undefined) {
    system_impl = system(world)
    systems.set(system, system_impl)
  }
  system_impl()
}
