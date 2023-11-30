import * as S from "silver-ecs"
import {Position} from "silver-lib"

interface Rect {
  hw: number
  hh: number
}
export let Grid = S.tag()
export let Rect = S.value<Rect>({hw: "f32", hh: "f32"})
export let InCell = S.relation()
export let CellOf = S.relation()

export const CELL_SIZE = 500
export const CELL_COUNT = 100

export let gridSystem: S.System = world => {
  let boxes = S.query(world, S.type(Position, Rect), S.Not(CellOf))
  let cells = S.query(world, S.type(Position, Rect, CellOf))
  let cellContents = S.query(world, S.type(InCell, Position, Rect))
  let grid = world.with(Grid).with(Position).spawn()
  let n = Math.sqrt(CELL_COUNT)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      world
        .with(CellOf, grid)
        .with(
          Position,
          Position.make({
            x: i * CELL_SIZE,
            y: j * CELL_SIZE,
          }),
        )
        .with(Rect, {hw: CELL_SIZE * 0.5, hh: CELL_SIZE * 0.5})
        .spawn()
    }
  }
  return () => {
    cells.each(grid, function releaseOldCellBoxes(cell, cellPos, cellRect) {
      let cellR = cellPos.x + cellRect.hw
      let cellL = cellPos.x - cellRect.hw
      let cellT = cellPos.y - cellRect.hh
      let cellB = cellPos.y + cellRect.hh
      // Check to see if each of the cell's boxes is still contained by the
      // cell.
      cellContents.each(cell, function releaseOldCellBox(box, boxPos, boxRect) {
        let boxL = boxPos.x - boxRect.hw
        if (boxL > cellR) return world.remove(box, InCell, cell)
        let boxR = boxPos.x + boxRect.hw
        if (boxR < cellL) return world.remove(box, InCell, cell)
        let boxT = boxPos.y - boxRect.hh
        if (boxT > cellB) return world.remove(box, InCell, cell)
        let boxB = boxPos.y + boxRect.hh
        if (boxB < cellT) return world.remove(box, InCell, cell)
      })
      // Look over every box (slow) to see if it's now contained by this cell.
      boxes.each(function findNewCellBoxes(box, boxPos, boxRect) {
        let boxL = boxPos.x - boxRect.hw
        if (boxL >= cellR) return
        let boxR = boxPos.x + boxRect.hw
        if (boxR <= cellL) return
        let boxT = boxPos.y - boxRect.hh
        if (boxT >= cellB) return
        let boxB = boxPos.y + boxRect.hh
        if (boxB <= cellT) return
        if (!world.has(box, InCell, cell)) {
          world.add(box, InCell, cell)
        }
      })
    })
  }
}
