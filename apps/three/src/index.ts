import {make, run} from "silver-ecs"
import {rapier3dSystem} from "silver-rapier"
import {threeSystem} from "silver-three"
import {spawnSystem} from "./systems"

const world = make()
const loop = () => {
  requestAnimationFrame(loop)
  world.step()
  run(world, spawnSystem)
  run(world, rapier3dSystem)
  run(world, threeSystem)
}

requestAnimationFrame(loop)
