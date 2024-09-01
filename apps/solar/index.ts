import {
  after,
  app,
  before,
  effect,
  query,
  System,
  when,
  World,
} from "silver-ecs"
import {Time, Timestep} from "silver-ecs/plugins"
import {canvas, circle, clear, context, transform} from "./canvas"
import {Color, Name, Orbits, Position, Radius} from "./data"

let FONT_SIZE = 12 * window.devicePixelRatio

let satellites = query()
  .with(Position)
  .with(Orbits, body => body.with(Position))

let move_satellites: System = world => {
  let step = world.get_resource(Timestep.res).step()
  world.for_each(satellites, (satellite_pos, orbiting_pos) => {
    let period = 0.1
    let a = ((Math.PI / 180) * step) / period / 100
    satellite_pos.x = orbiting_pos.x + 30 * Math.cos(a)
    satellite_pos.y = orbiting_pos.y + 30 * Math.sin(a)
  })
}

let bodies = query().with(Name).with(Color).with(Position).with(Radius)

let draw_bodies: System = world => {
  context.save()
  context.font = `${FONT_SIZE * transform.scale}px monospace`
  context.translate(canvas.width / 2, canvas.height / 2)
  world.for_each(bodies, (name, color, position, radius) => {
    context.save()
    context.translate(position.x, position.y)
    circle(color, radius)
    context.fillStyle = "#ccc"
    context.fillText(name, radius + 2, radius + 2)
    context.restore()
  })
  context.restore()
}

let clear_canvas: System = () => {
  clear()
}

let log_orbits = effect(
  [Orbits],
  e => {
    console.log("in", e)
  },
  e => {
    console.log("out", e)
  },
)

let body = (
  world: World,
  name: string,
  color: string,
  x: number,
  y: number,
  radius: number,
) =>
  world
    .with(Name, name)
    .with(Color, color)
    .with(Position, {x, y})
    .with(Radius, radius)

let game = app()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .add_init_system(world => {
    let sun = body(world, "Sun", "#ff0", 0, 0, 10).spawn()
    let earth = body(world, "Earth", "#00f", 30, 0, 3).with(Orbits(sun)).spawn()
    body(world, "Moon", "#aaa", 5, 0, 1).with(Orbits(earth)).spawn()
  })
  .add_system(move_satellites, before(clear_canvas), when(Timestep.logical))
  .add_system(clear_canvas)
  .add_system(draw_bodies, after(clear_canvas))
  .add_effect(log_orbits)

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}

loop()
