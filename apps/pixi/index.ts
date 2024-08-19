import {App, System, World, after, query} from "silver-ecs"
import {Position} from "silver-lib"
import {Bunny} from "./bunny"
import {Rect, create_grid, grid_system} from "./grid"
import {render_system} from "./render"

let spawn_system: System = (world: World.T) => {
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
}

let bunnies = query(Bunny, Position)

let move_bunnies: System = world => {
  world.for_each(bunnies, function move_bunny(_, pos) {
    pos.x += 0.4
    pos.y += 0.4
  })
}

let app = App.make()
  .add_init_system(spawn_system)
  .add_init_system(create_grid)
  .add_system(move_bunnies)
  .add_system(grid_system, after(move_bunnies))
  .add_system(render_system, after(grid_system), after(move_bunnies))

let loop = () => {
  app.run()
  requestAnimationFrame(loop)
}

loop()
