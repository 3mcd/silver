import * as World from "../world/world"

type System = (world: World.T) => () => void

let systems = new Map<System, ReturnType<System>>()

export let run = (
  world: World.T,
  system: (world: World.T) => () => void,
): void => {
  let systemImpl = systems.get(system)
  if (systemImpl === undefined) {
    systemImpl = system(world)
    systems.set(system, systemImpl)
  }
  systemImpl()
}
