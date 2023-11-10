import {make, run} from "silver-ecs"
import {threeSystem} from "silver-three"
import {inputSystem, moveSystem, spawnSystem} from "./systems"

const world = make()
const loop = () => {
  requestAnimationFrame(loop)
  world.step()
  run(world, spawnSystem)
  run(world, inputSystem)
  run(world, moveSystem)
  run(world, threeSystem)
}

requestAnimationFrame(loop)
