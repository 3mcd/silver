import {Entity, Not, query, ref, rel, System, tag} from "silver-ecs"
import {Position} from "silver-lib"

interface Rect {
  hw: number
  hh: number
}
export let Grid = tag()
export let Rect = ref<Rect>({hw: "f32", hh: "f32"})
export let InCell = rel()
export let CellOf = rel()
export let Left = rel({exclusive: true})
export let Right = rel({exclusive: true})
export let Top = rel({exclusive: true})
export let Bottom = rel({exclusive: true})

export let CELL_SIZE = 500
export let CELL_COUNT = 256
export let CELL_SQRT = Math.sqrt(CELL_COUNT)

let boxes = query(Position, Rect, Not(CellOf("*")), Not(InCell("*")))
let cells = query(Position, Rect, CellOf("*"))
let cell_boxes = query(InCell("*"), Position, Rect)
let cell_lookup: Entity[] = []

export let create_grid: System = world => {
  let grid = world.with(Grid).with(Position).spawn()
  for (let i = 0; i < CELL_SQRT; i++) {
    for (let j = 0; j < CELL_SQRT; j++) {
      let cell = world
        .with(CellOf(grid))
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
      cell_lookup.push(cell)
    }
  }
  for (let i = 0; i < cell_lookup.length; i++) {
    let cell = cell_lookup[i]
    let cell_l = i % CELL_SQRT === 0 ? undefined : cell_lookup[i - 1]
    if (cell_l) {
      world.add(cell, Left(cell_l))
    }
    let cell_r =
      i % CELL_SQRT === CELL_SQRT - 1 ? undefined : cell_lookup[i + 1]
    if (cell_r) {
      world.add(cell, Right(cell_r))
    }
    let cell_t = i < CELL_SQRT ? undefined : cell_lookup[i - CELL_SQRT]
    if (cell_t) {
      world.add(cell, Top(cell_t))
    }
    let cell_b =
      i >= CELL_COUNT - CELL_SQRT ? undefined : cell_lookup[i + CELL_SQRT]
    if (cell_b) {
      world.add(cell, Bottom(cell_b))
    }
  }
}

export let grid_system: System = world => {
  let grid = world.single(Grid)
  world.for_each(
    cells,
    grid,
    function release_old_cell_boxes(cell, cell_pos, cell_rect) {
      let cell_r = cell_pos.x + cell_rect.hw
      let cell_l = cell_pos.x - cell_rect.hw
      let cell_t = cell_pos.y - cell_rect.hh
      let cell_b = cell_pos.y + cell_rect.hh
      // Check to see if each of the cell's boxes is still contained by the
      // cell.
      world.for_each(
        cell_boxes,
        cell,
        function release_old_cell_box(box, box_pos, box_rect) {
          let box_l = box_pos.x - box_rect.hw
          let box_r = box_pos.x + box_rect.hw
          let box_t = box_pos.y - box_rect.hh
          let box_b = box_pos.y + box_rect.hh
          if (
            box_l > cell_r ||
            box_r < cell_l ||
            box_t > cell_b ||
            box_b < cell_t
          ) {
            world.remove(box, InCell(cell))
          }
          if (box_l < cell_l) {
            let cell_l = world.get_exclusive_relative(cell, Left("*"))
            if (cell_l && !world.has(box, InCell(cell_l))) {
              world.add(box, InCell(cell_l))
            }
          }
          if (box_r > cell_r) {
            let cell_r = world.get_exclusive_relative(cell, Right("*"))
            if (cell_r && !world.has(box, InCell(cell_r))) {
              world.add(box, InCell(cell_r))
            }
          }
          if (box_t < cell_t) {
            let cell_t = world.get_exclusive_relative(cell, Top("*"))
            if (cell_t && !world.has(box, InCell(cell_t))) {
              world.add(box, InCell(cell_t))
            }
          }
          if (box_b > cell_b) {
            let cell_b = world.get_exclusive_relative(cell, Bottom("*"))
            if (cell_b && !world.has(box, InCell(cell_b))) {
              world.add(box, InCell(cell_b))
            }
          }
        },
      )
    },
  )
  let grid_pos: Position
  try {
    grid_pos = world.get(grid, Position)
  } catch {
    return
  }
  let grid_l = grid_pos.x - CELL_SQRT * CELL_SIZE
  let grid_r = grid_pos.x + CELL_SQRT * CELL_SIZE
  let grid_t = grid_pos.y - CELL_SQRT * CELL_SIZE
  let grid_b = grid_pos.y + CELL_SQRT * CELL_SIZE
  world.for_each(boxes, function find_box_cells(box, box_pos, box_rect) {
    let box_l = box_pos.x - box_rect.hw
    let box_r = box_pos.x + box_rect.hw
    let box_t = box_pos.y - box_rect.hh
    let box_b = box_pos.y + box_rect.hh
    if (
      box_l <= grid_r &&
      box_r >= grid_l &&
      box_t <= grid_b &&
      box_b >= grid_t
    ) {
      world.for_each(
        cells,
        grid,
        function find_box_cells_inner(cell, cell_pos, cell_rect) {
          let cell_r = cell_pos.x + cell_rect.hw
          let cell_l = cell_pos.x - cell_rect.hw
          let cell_t = cell_pos.y - cell_rect.hh
          let cell_b = cell_pos.y + cell_rect.hh
          if (
            box_l <= cell_r &&
            box_r >= cell_l &&
            box_t <= cell_b &&
            box_b >= cell_t
          ) {
            world.add(box, InCell(cell))
          }
        },
      )
    }
  })
}
