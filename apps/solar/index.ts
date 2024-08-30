import {after, App, before, effect, query} from "silver-ecs"
import {canvas, circle, clear, context, transform} from "./canvas"
import {Color, Name, Orbits, Position, Radius} from "./data"

let FONT_SIZE = 12 * window.devicePixelRatio

let satellites = query()
  .with(Position)
  .with(Orbits, body => body.with(Position))

let tick = 0

let move_satellites: App.System = world => {
  world.for_each(satellites, (satellite_pos, orbiting_pos) => {
    let period = 0.1
    let a = ((Math.PI / 180) * tick) / period / 100
    satellite_pos.x = orbiting_pos.x + 30 * Math.cos(a)
    satellite_pos.y = orbiting_pos.y + 30 * Math.sin(a)
  })
  tick++
}

let bodies = query().with(Name).with(Color).with(Position).with(Radius)

let draw_bodies: App.System = world => {
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

let clear_canvas: App.System = () => {
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

let app = App.make()
  .add_init_system(world => {
    let sun = world
      .with(Name, "Sun")
      .with(Color, "#fff")
      .with(Position, {x: 0, y: 0})
      .with(Radius, 10)
      .spawn()
    let earth = world
      .with(Name, "Earth")
      .with(Color, "#00f")
      .with(Position, {x: 50, y: 0})
      .with(Radius, 5)
      .with(Orbits(sun))
      .spawn()
    world
      .with(Name, "Moon")
      .with(Color, "#aaa")
      .with(Position, {x: 0, y: 0})
      .with(Radius, 2)
      .with(Orbits(earth))
      .spawn()

    setTimeout(() => {
      world.remove(earth, Orbits(sun))
      setTimeout(() => {
        world.add(earth, Orbits(sun))
      }, 5000)
    }, 5000)
  })
  .add_system(move_satellites, before(clear_canvas))
  .add_system(clear_canvas)
  .add_system(draw_bodies, after(clear_canvas))
  .add_effect(log_orbits)

let loop = () => {
  app.run()
  requestAnimationFrame(loop)
}

loop()
