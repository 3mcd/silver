import * as Pixi from "pixi.js"
import {ref, System, query, In, Out} from "silver-ecs"
import {DebugHighlighted, DebugSelected, Position} from "silver-lib"
import {CellOf, Grid, InCell, Rect} from "./grid"
import {Bunny} from "./bunny"

export let Sprite = ref<Pixi.Sprite>()
export let Graphics = ref<Pixi.Graphics>()

let renderer = await Pixi.autoDetectRenderer({
  preference: "webgpu",
  clearBeforeRender: true,
  backgroundAlpha: 1,
  backgroundColor: 0xffffff,
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: 1,
  antialias: false,
})
let stage = new Pixi.Container()
let huh = new Pixi.Container()
stage.addChild(huh)
stage.position.set(renderer.screen.width / 2, renderer.screen.height / 2)
let texture = await Pixi.Assets.load("bunny.png")

let dragging = false

let x = 0
let y = 0

let on_drag_start = (event: MouseEvent) => {
  dragging = true
}

let on_drag = (event: MouseEvent) => {
  if (!dragging) {
    return
  }
  x -= event.movementX
  y -= event.movementY
  huh.pivot.set(x, y)
}

let on_drag_end = (event: MouseEvent) => {
  dragging = false
}

let on_wheel = (event: WheelEvent) => {
  let scale = 1 + event.deltaY * 0.001
  huh.scale.set(huh.scale.x * scale, huh.scale.y * scale)
  // huh.scale.x *= scale
  // huh.scale.y *= scale
}

document.addEventListener("pointerdown", on_drag_start)
document.addEventListener("pointermove", on_drag)
document.addEventListener("pointerup", on_drag_end)
document.addEventListener("wheel", on_wheel)

console.log(window.innerWidth, window.innerHeight)

// stage.position.x = 256 *
let boxes = query(InCell("*"))
let grids = query(Grid, Position)
let cells = query(CellOf("*"), Graphics)
let cells_in = query(CellOf("*"), Position, Rect, In())
let sprites_selected_enter = query(Sprite, DebugSelected, In(DebugSelected))
let sprites_selected_exit = query(Sprite, DebugSelected, Out())
let sprites_highlighted_enter = query(Sprite, DebugHighlighted, In())
let sprites_highlighted_exit = query(Sprite, DebugHighlighted, Out())
let bunnies = query(Sprite, Position, Rect)
let bunnies_in = query(Bunny, Position, Rect, In())
let bunnies_out = query(Sprite, Out(Bunny))

export let render_system: System = world => {
  world.for_each(grids, function renderGrid(grid, gridPos) {
    world.for_each(
      cells_in,
      grid,
      function init_cell(cell, cell_pos, cell_rect) {
        let graphics = new Pixi.Graphics()
        graphics
          .rect(0, 0, cell_rect.hw * 2, cell_rect.hh * 2)
          .stroke({
            color: 0xdddddd,
          })
          .fill({
            color: 0xffffff,
            alpha: 0.2,
          })
        graphics.x = gridPos.x + cell_pos.x - cell_rect.hw
        graphics.y = gridPos.y + cell_pos.y - cell_rect.hh
        world.add(cell, Graphics, graphics)
        huh.addChild(graphics)
      },
    )
    world.for_each(cells, grid, function color_cell(cell, cell_graphics) {
      let cell_contains_object = false
      world.for_each(boxes, cell, _ => {
        cell_contains_object = true
      })
      if (cell_contains_object) {
        cell_graphics.tint = 0x00ff00
        cell_graphics.zIndex = 2
      } else {
        cell_graphics.tint = 0xffffff
        cell_graphics.zIndex = 1
      }
    })
  })
  world.for_each(sprites_selected_enter, function select_sprite(_, sprite) {
    sprite.tint = 0x00ff00
  })
  world.for_each(
    sprites_selected_exit,
    function deselect_sprite(entity, sprite) {
      if (world.is_alive(entity)) {
        sprite.tint = world.has(entity, DebugHighlighted) ? 0x0000ff : 0xffffff
      }
    },
  )
  world.for_each(
    sprites_highlighted_enter,
    function highlight_sprite(_, sprite) {
      sprite.tint = 0x0000ff
    },
  )
  world.for_each(
    sprites_highlighted_exit,
    function unhighlight_sprite(entity, sprite) {
      if (world.is_alive(entity)) {
        sprite.tint = world.has(entity, DebugSelected) ? 0x00ff00 : 0xffffff
      }
    },
  )
  world.for_each(
    bunnies,
    function update_sprite_position(_, sprite, position, rect) {
      sprite.x = position.x - rect.hw
      sprite.y = position.y - rect.hh
    },
  )
  world.for_each(bunnies_out, function remove_sprite(entity, sprite) {
    huh.removeChild(sprite)
    if (world.is_alive(entity)) {
      world.remove(entity, Sprite)
    }
  })
  world.for_each(bunnies_in, function init_sprite(entity, position, rect) {
    let sprite = new Pixi.Sprite(texture)
    sprite.anchor.x = sprite.anchor.y = 0.5
    sprite.position.x = position.x
    sprite.position.y = position.y
    sprite.width = rect.hw * 2
    sprite.height = rect.hh * 2
    sprite.zIndex = 3
    huh.addChild(sprite)
    world.add(entity, Sprite, sprite)
  })
  renderer.render(stage)
}

document
  .getElementById("render")!
  .appendChild(renderer.view.canvas as HTMLCanvasElement)
