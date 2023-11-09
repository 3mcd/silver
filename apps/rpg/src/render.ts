import * as ecs from "silver-ecs/dev"
import {Player, Position} from "./schema"

export let render_player_system: ecs.System = world => {
  let players = ecs.query(world, Position, ecs.Is(Player))
  const canvas = document.querySelector("canvas")
  if (canvas === null) {
    throw new Error("Canvas not found")
  }
  const canvas_context = canvas.getContext("2d")
  if (canvas_context === null) {
    throw new Error("Canvas context not found")
  }
  return () => {
    canvas_context.clearRect(0, 0, canvas.width, canvas.height)
    players.each((_, position) => {
      canvas_context.fillStyle = "red"
      canvas_context.fillRect(position.x, position.y, 10, 10)
    })
  }
}
