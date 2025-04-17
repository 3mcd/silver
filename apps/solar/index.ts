import {App, Effect, Query, System, World} from "silver-ecs"
import {Time, Timestep} from "silver-ecs/plugins"
import {canvas, circle, clear, context, transform} from "./canvas"
import {Angvel, Color, Name, Orbits, Position, Radius} from "./data"

let FONT_SIZE = 12 * window.devicePixelRatio

let satellites = Query.make(Position)
  .read(Angvel)
  .read(Orbits, body => body.read(Position))

let move_satellites: App.System = world => {
  let step = world.get_resource(Timestep.res).step()
  world.for_each(
    satellites,
    (satellite_pos, satellite_angvel, orbiting_pos) => {
      let period = 0.1
      let a = ((Math.PI / 180) * step * satellite_angvel) / period / 100
      satellite_pos.x = orbiting_pos.x + 30 * Math.cos(a)
      satellite_pos.y = orbiting_pos.y + 30 * Math.sin(a)
    },
  )
}

let bodies = Query.make(Name).read(Color).read(Position).read(Radius)

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

let log_orbits = Effect.make(
  [Orbits],
  (world, entity) => {
    let orbits = world.get_exclusive_relative(entity, Orbits)
    console.log(world.get(entity, Name), "orbits", world.get(orbits, Name))
  },
  (world, entity) => {
    console.log(entity, "no longer orbits anything")
  },
)

type BodyOptions = {
  name: string
  color: string
  x: number
  y: number
  r: number
  av: number
}

let body = (world: World.t, options: BodyOptions) =>
  world
    .with(Name, options.name)
    .with(Color, options.color)
    .with(Position, {x: options.x, y: options.y})
    .with(Radius, options.r)
    .with(Angvel, options.av)

let sun_options = {
  name: "sun",
  color: "#ff0",
  x: 0,
  y: 0,
  r: 10,
  av: 0,
}

let earth_options = {
  name: "earth",
  color: "#00f",
  x: 30,
  y: 0,
  r: 3,
  av: 2,
}

let moon_options = {
  name: "moon",
  color: "#aaa",
  x: 5,
  y: 0,
  r: 1,
  av: 10,
}

let game = App.make()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .add_system(
    move_satellites,
    System.before(clear_canvas),
    System.when(Timestep.logical),
  )
  .add_system(clear_canvas)
  .add_system(draw_bodies, System.after(clear_canvas))
  .add_effect(log_orbits)
  .add_init_system(world => {
    let sun = body(world, sun_options).spawn()
    let earth = body(world, earth_options).with(Orbits(sun)).spawn()
    let moon = body(world, moon_options).with(Orbits(earth)).spawn()
    console.log("sun", sun, "earth", earth, "moon", moon)
    document.addEventListener("click", () => {
      if (world.has(earth, Orbits(sun))) {
        world.remove(earth, Orbits(sun))
      } else {
        if (world.has(moon, Orbits(earth))) {
          world.remove(moon, Orbits(earth))
        } else {
          world.add(moon, Orbits(earth))
          world.add(earth, Orbits(sun))
        }
      }
    })
  })

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}

loop()
