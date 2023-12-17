import * as S from "silver-ecs"
import {Position} from "silver-lib"
import {Rect, gridSystem} from "./grid"
import {renderSystem} from "./render"
import {world} from "./world"
import {Bunny, bunniesSystem} from "./bunnies"

let spawnSystem: S.System = () => {
  for (let i = 0; i < 1_000; i++) {
    world
      .with(Bunny)
      .with(Position, {
        x: (Math.random() - 0.5) * 10_000,
        y: (Math.random() - 0.5) * 10_000,
        z: 0,
      })
      .with(Rect, {
        hw: 26 * 0.5,
        hh: 37 * 0.5,
      })
      .spawn()
  }
  return () => {}
}

let loop = () => {
  S.run(world, spawnSystem)
  S.run(world, bunniesSystem)
  S.run(world, gridSystem)
  S.run(world, renderSystem)
  world.step()
  requestAnimationFrame(loop)
}

loop()
