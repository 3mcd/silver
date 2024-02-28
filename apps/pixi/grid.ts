import * as S from "silver-ecs"
import {Position} from "silver-lib"

interface Rect {
  hw: number
  hh: number
}
export let Grid = S.tag()
export let Rect = S.ref<Rect>({hw: "f32", hh: "f32"})
export let InCell = S.relation()
export let CellOf = S.relation()
export let Left = S.relation(S.Topology.Exclusive)
export let Right = S.relation(S.Topology.Exclusive)
export let Top = S.relation(S.Topology.Exclusive)
export let Bottom = S.relation(S.Topology.Exclusive)

export const CELL_SIZE = 500
export const CELL_COUNT = 256
export const CELL_SQRT = Math.sqrt(CELL_COUNT)

export let gridSystem: S.System = world => {
  let boxes = S.query(
    world,
    S.type(Position, Rect),
    S.Not(CellOf),
    S.Not(InCell),
  )
  let cells = S.query(world, S.type(Position, Rect, CellOf))
  let cellBoxes = S.query(world, S.type(InCell, Position, Rect))
  let cellLookup: S.Entity[] = []
  let grid = world.with(Grid).with(Position).spawn()
  for (let i = 0; i < CELL_SQRT; i++) {
    for (let j = 0; j < CELL_SQRT; j++) {
      let cell = world
        .with(CellOf, grid)
        .with(
          Position,
          Position.make({
            x: j * CELL_SIZE,
            y: i * CELL_SIZE,
          }),
        )
        .with(Rect, {
          hw: CELL_SIZE * 0.5,
          hh: CELL_SIZE * 0.5,
        })
        .spawn()
      cellLookup.push(cell)
    }
  }
  for (let i = 0; i < cellLookup.length; i++) {
    let cell = cellLookup[i]
    let cellLeft = i % CELL_SQRT === 0 ? undefined : cellLookup[i - 1]
    if (cellLeft) {
      world.add(cell, Left, cellLeft)
    }
    let cellRight =
      i % CELL_SQRT === CELL_SQRT - 1 ? undefined : cellLookup[i + 1]
    if (cellRight) {
      world.add(cell, Right, cellRight)
    }
    let cellTop = i < CELL_SQRT ? undefined : cellLookup[i - CELL_SQRT]
    if (cellTop) {
      world.add(cell, Top, cellTop)
    }
    let cellBottom =
      i >= CELL_COUNT - CELL_SQRT ? undefined : cellLookup[i + CELL_SQRT]
    if (cellBottom) {
      world.add(cell, Bottom, cellBottom)
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
      cellBoxes.each(cell, function releaseOldCellBox(box, boxPos, boxRect) {
        let boxL = boxPos.x - boxRect.hw
        let boxR = boxPos.x + boxRect.hw
        let boxT = boxPos.y - boxRect.hh
        let boxB = boxPos.y + boxRect.hh
        if (boxL > cellR || boxR < cellL || boxT > cellB || boxB < cellT) {
          world.remove(box, InCell, cell)
        }
        if (boxL < cellL) {
          let cellLeft = world.getExclusiveRelative(cell, Left)
          if (cellLeft && !world.has(box, InCell, cellLeft)) {
            world.add(box, InCell, cellLeft)
          }
        }
        if (boxR > cellR) {
          let cellRight = world.getExclusiveRelative(cell, Right)
          if (cellRight && !world.has(box, InCell, cellRight)) {
            world.add(box, InCell, cellRight)
          }
        }
        if (boxT < cellT) {
          let cellTop = world.getExclusiveRelative(cell, Top)
          if (cellTop && !world.has(box, InCell, cellTop)) {
            world.add(box, InCell, cellTop)
          }
        }
        if (boxB > cellB) {
          let cellBottom = world.getExclusiveRelative(cell, Bottom)
          if (cellBottom && !world.has(box, InCell, cellBottom)) {
            world.add(box, InCell, cellBottom)
          }
        }
      })
    })
    let gridPos: Position
    try {
      gridPos = world.get(grid, Position)
    } catch {
      return
    }
    const gridL = gridPos.x - CELL_SQRT * CELL_SIZE
    const gridR = gridPos.x + CELL_SQRT * CELL_SIZE
    const gridT = gridPos.y - CELL_SQRT * CELL_SIZE
    const gridB = gridPos.y + CELL_SQRT * CELL_SIZE
    boxes.each(function findCellsForBoxesThatNowIntersectGrid(
      box,
      boxPos,
      boxRect,
    ) {
      let boxL = boxPos.x - boxRect.hw
      let boxR = boxPos.x + boxRect.hw
      let boxT = boxPos.y - boxRect.hh
      let boxB = boxPos.y + boxRect.hh
      if (boxL <= gridR && boxR >= gridL && boxT <= gridB && boxB >= gridT) {
        cells.each(
          grid,
          function findCellsForBoxesThatNowIntersectGridInner(
            cell,
            cellPos,
            cellRect,
          ) {
            let cellR = cellPos.x + cellRect.hw
            let cellL = cellPos.x - cellRect.hw
            let cellT = cellPos.y - cellRect.hh
            let cellB = cellPos.y + cellRect.hh
            if (
              boxL <= cellR &&
              boxR >= cellL &&
              boxT <= cellB &&
              boxB >= cellT
            ) {
              world.add(box, InCell, cell)
            }
          },
        )
      }
    })
  }
}
