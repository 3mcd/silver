import {expect, test} from "vitest"
import * as World from "./world.ts"
import * as Component from "./component.ts"
import * as QueryBuilder from "./query_builder.ts"

class Pos {
  constructor(public x = 0, public y = 0) {}
}

test("integration", async () => {
  let world = World.make()
  let Name = Component.ref<string>()
  let Rect = Component.ref<Pos>()
  let Likes = Component.rel()
  let InGrid = Component.rel()
  let InCell = Component.rel()
  let IsFood = Component.tag()
  let query_builder = QueryBuilder.make()
    .read(Name)
    .read(Likes, likes =>
      likes
        .read(Name)
        .read(IsFood)
        .read(InCell, cell =>
          cell.read(Rect).read(InGrid, grid => grid.read(Rect)),
        ),
    )

  let grid = world.with(Rect, new Pos()).spawn()
  let cell_0 = world.with(Rect, new Pos(2, 4)).with(InGrid(grid)).spawn()
  let cell_1 = world.with(Rect, new Pos(1)).with(InGrid(grid)).spawn()

  let apple = world
    .with(Name, "Apple")
    .with(IsFood)
    .with(InCell(cell_0))
    .spawn()
  let grape = world
    .with(Name, "Grape")
    .with(IsFood)
    .with(InCell(cell_1))
    .spawn()
  let plank = world.with(Name, "Plank").with(InCell(cell_1)).spawn()

  world.with(Name, "Stevie").with(Likes(apple)).spawn()
  world.with(Name, "Aubrey").with(Likes(apple)).with(Likes(grape)).spawn()
  world.with(Name, "Jordan").with(Likes(plank)).spawn()

  world.step()

  let results: [string, string, Pos, Pos][] = []

  world.for_each(
    query_builder,
    (person_name, food_name, food_cell_pos, food_grid_pos) => {
      results.push([person_name, food_name, food_cell_pos, food_grid_pos])
    },
  )

  expect(results).toEqual([
    ["Stevie", "Apple", {x: 2, y: 4}, {x: 0, y: 0}],
    ["Aubrey", "Apple", {x: 2, y: 4}, {x: 0, y: 0}],
    ["Aubrey", "Grape", {x: 1, y: 0}, {x: 0, y: 0}],
  ])
})
