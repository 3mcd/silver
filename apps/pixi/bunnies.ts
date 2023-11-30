import * as S from "silver-ecs"
import {Position} from "silver-lib"

export let Bunny = S.tag()

export let bunniesSystem: S.System = world => {
  let bunnies = S.query(world, S.type(Bunny, Position))
  return () => {
    bunnies.each(function moveBunny(_, pos) {
      pos.x += 0.4
      pos.y += 0.4
    })
  }
}
