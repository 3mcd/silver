import * as Pixi from "pixi.js"
import * as S from "silver-ecs"
import {DebugHighlighted, DebugSelected, Position} from "silver-lib"
import {CellOf, Grid, InCell, Rect} from "./grid"
import {Bunny} from "./bunnies"

export let Sprite = S.value<Pixi.Sprite>()
export let Graphics = S.value<Pixi.Graphics>()

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
let texture = await Pixi.Assets.load("bunny.png")

export let renderSystem: S.System = world => {
  let boxes = S.query(world, InCell)
  let grids = S.query(world, S.type(Grid, Position))
  let cells = S.query(world, S.type(CellOf, Graphics))
  let cellsIn = S.query(world, S.type(CellOf, Position, Rect), S.In())
  let spritesSelectedIn = S.query(
    world,
    S.type(Sprite, DebugSelected),
    S.In(DebugSelected),
  )
  let spritesSelectedOut = S.query(
    world,
    S.type(Sprite, DebugSelected),
    S.Out(),
  )
  let spritesHighlightedIn = S.query(
    world,
    S.type(Sprite, DebugHighlighted),
    S.In(),
  )
  let spritesHighlightedOut = S.query(
    world,
    S.type(Sprite, DebugHighlighted),
    S.Out(),
  )
  let bunnies = S.query(world, S.type(Sprite, Position, Rect))
  let bunniesOut = S.query(world, Sprite, S.Out(Bunny))
  let bunniesIn = S.query(world, S.type(Bunny, Position, Rect), S.In())

  return () => {
    grids.each(function renderGrid(grid, gridPos) {
      cellsIn.each(grid, function initCell(cell, cellPos, cellRect) {
        let graphics = new Pixi.Graphics()
        graphics.rect(0, 0, cellRect.hw * 2, cellRect.hh * 2).stroke({
          color: 0xde3249,
          width: 3,
        })
        graphics.x = gridPos.x + cellPos.x - cellRect.hw
        graphics.y = gridPos.y + cellPos.y - cellRect.hh
        world.add(cell, Graphics, graphics)
        stage.addChild(graphics)
      })
      cells.each(grid, function colorCell(cell, cellGraphics) {
        let cellContainsObject = false
        boxes.each(cell, _ => {
          cellContainsObject = true
        })
        if (cellContainsObject) {
          cellGraphics.tint = 0x00ff00
          cellGraphics.zIndex = 2
        } else {
          cellGraphics.tint = 0xffffff
          cellGraphics.zIndex = 1
        }
      })
    })
    spritesSelectedIn.each(function selectSprite(_, sprite) {
      sprite.tint = 0x00ff00
    })
    spritesSelectedOut.each(function deselectSprite(entity, sprite) {
      if (world.isAlive(entity)) {
        sprite.tint = world.has(entity, DebugHighlighted) ? 0x0000ff : 0xffffff
      }
    })
    spritesHighlightedIn.each(function highlightSprite(_, sprite) {
      sprite.tint = 0x0000ff
    })
    spritesHighlightedOut.each(function unhighlightSprite(entity, sprite) {
      if (world.isAlive(entity)) {
        sprite.tint = world.has(entity, DebugSelected) ? 0x00ff00 : 0xffffff
      }
    })
    bunnies.each(function updateSpritePosition(_, sprite, position, rect) {
      sprite.x = position.x - rect.hw
      sprite.y = position.y - rect.hh
    })
    bunniesOut.each(function removeSprite(entity, sprite) {
      stage.removeChild(sprite)
      if (world.isAlive(entity)) {
        world.remove(entity, Sprite)
      }
    })
    bunniesIn.each(function initSprite(entity, position, rect) {
      let sprite = new Pixi.Sprite(texture)
      sprite.anchor.x = sprite.anchor.y = 0.5
      sprite.position.x = position.x
      sprite.position.y = position.y
      sprite.width = rect.hw * 2
      sprite.height = rect.hh * 2
      sprite.zIndex = 3
      stage.addChild(sprite)
      world.add(entity, Sprite, sprite)
    })
    renderer.render(stage)
  }
}

document
  .getElementById("render")!
  .appendChild(renderer.view.canvas as HTMLCanvasElement)
