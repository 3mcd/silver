import {App, Component, Effect, Selector, System, World} from "silver-ecs"
import {Commands, Time, Timestep} from "silver-ecs/plugins"
import {
  arc,
  canvas,
  circle,
  clear,
  context,
  dpr,
  image,
  to_world_x,
  to_world_y,
  transform,
} from "./canvas"

let FONT_SIZE = 12 * dpr

type Position = {x: number; y: number}

export let LocalPosition = Component.ref<Position>({x: "f32", y: "f32"})
export let Position = Component.ref<Position>({x: "f32", y: "f32"})
export let Radius = Component.ref<number>("f32")
export let Angvel = Component.ref<number>("f32")
export let Name = Component.ref<string>("string")
export let Color = Component.ref<string>("string")
export let Sprite = Component.ref<string>("string")

export let Orbits = Component.rel({exclusive: true})

type BodyOptions = {
  name: string
  color: string
  x: number
  y: number
  r: number
  av: number
}

let make_body = (world: World.t, options: BodyOptions) =>
  world
    .with(Name, options.name)
    .with(Color, options.color)
    .with(LocalPosition, {x: options.x, y: options.y})
    .with(Position, {x: 0, y: 0})
    .with(Radius, options.r)
    .with(Angvel, options.av)

let log_orbits = Effect.make([Orbits], (world, entity) => {
  let orbits = world.get_exclusive_relative(entity, Orbits)
  console.log(world.get(entity, Name), "orbits", world.get(orbits, Name))
})

let log_bodies = Effect.make(
  [Name],
  (world, entity) => {
    console.log("body", world.get(entity, Name), "spawned")
  },
  (world, entity) => {
    console.log("body", world.get(entity, Name), "despawned")
  },
)

let satellites = Selector.make(LocalPosition)
  .with(Position)
  .with(Angvel)
  .with(Orbits, body => body.with(Position))

let move_satellites: App.System = world => {
  let step = world.get_resource(Timestep.res).step()
  world.for_each(
    satellites,
    (satellite_local_pos, satellite_pos, satellite_angvel, orbiting_pos) => {
      let a = (Math.PI / 180) * step * satellite_angvel * 0.1
      let cos_a = Math.cos(a)
      let sin_a = Math.sin(a)
      let x = satellite_local_pos.x * cos_a - satellite_local_pos.y * sin_a
      let y = satellite_local_pos.x * sin_a + satellite_local_pos.y * cos_a
      satellite_pos.x = x + orbiting_pos.x
      satellite_pos.y = y + orbiting_pos.y
    },
  )
}

let bodies = Selector.make().with(Position).with(Radius)
let bodies_full = bodies.with(Name).with(Color)

let draw_bodies: App.System = world => {
  context.save()
  context.font = `${FONT_SIZE * transform.scale}px monospace`
  context.translate(canvas.width / 2, canvas.height / 2)
  let scaled_width = canvas.width * transform.scale
  let scaled_height = canvas.height * transform.scale
  let hw = canvas.width / 2
  let hh = canvas.height / 2
  world.for_each(bodies_full, (position, radius, name, color, entity) => {
    if (
      position.x + radius + hw - transform.x > 0 &&
      position.x - radius + hw - transform.x < scaled_width &&
      position.y + radius + hh - transform.y > 0 &&
      position.y - radius + hh - transform.y < scaled_height
    ) {
      context.save()
      context.translate(position.x, position.y)
      let sprite = world.get(entity, Sprite)
      if (sprite) {
        image(sprite, radius * 2, radius * 2)
      } else {
        circle(color, radius)
      }
      context.fillStyle = "#ccc"
      context.fillText(name, radius + 2, radius + 2)
      context.restore()
    }
  })
  context.restore()
}

let orbits = Selector.make(LocalPosition).with(Orbits, body =>
  body.with(Position),
)
const draw_orbits: App.System = world => {
  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)
  world.for_each(orbits, (satellite_local_pos, orbiting_pos) => {
    context.save()
    context.translate(orbiting_pos.x, orbiting_pos.y)
    context.globalAlpha = 0.5
    arc("#333", satellite_local_pos.x, 0, 2 * Math.PI, transform.scale)
    context.restore()
  })
  context.restore()
}

let clear_canvas: App.System = () => {
  clear()
}

// resources
type Pointer = {x: number; y: number}
let Pointer = Component.ref<Pointer>()

// systems
let sun_def = {name: "sun", color: "#80591b", x: 0, y: 0, r: 15, av: 0}
let mercury_def = {name: "mercury", color: "#f80", x: 50, y: 0, r: 1, av: 1.5}
let earth_def = {name: "earth", color: "#00f", x: 130, y: 0, r: 3, av: 1}
let moon_def = {name: "moon", color: "#aaa", x: 5, y: 0, r: 1, av: 5}
let mars_def = {name: "mars", color: "#f00", x: 200, y: 0, r: 4, av: 0.5}
let venus_def = {name: "venus", color: "#f80", x: 100, y: 0, r: 5, av: 1}
let saturn_def = {name: "saturn", color: "#f80", x: 400, y: 0, r: 6, av: 0.05}
let jupiter_def = {name: "jupiter", color: "#955", x: 600, y: 0, r: 8, av: 0.01}
let io_def = {name: "io", color: "#f80", x: 15, y: 0, r: 1, av: 3}
let europa_def = {name: "europa", color: "#a55", x: 20, y: 0, r: 1, av: 2}
let uranus_def = {name: "uranus", color: "#0ff", x: 700, y: 0, r: 5, av: 0.01}
let neptune_def = {name: "neptune", color: "#00f", x: 800, y: 0, r: 5, av: 0.01}
let pluto_def = {name: "pluto", color: "#f80", x: 900, y: 0, r: 2, av: 0.01}

let spawn_bodies: App.System = world => {
  let sun = make_body(world, sun_def).with(Sprite, "./assets/sun.png").spawn()
  make_body(world, mercury_def).with(Orbits(sun)).spawn()
  let earth = make_body(world, earth_def)
    .with(Orbits(sun))
    .with(Sprite, "./assets/earth.png")
    .spawn()
  make_body(world, moon_def).with(Orbits(earth)).spawn()
  make_body(world, venus_def).with(Orbits(sun)).spawn()
  make_body(world, mars_def).with(Orbits(sun)).spawn()
  make_body(world, saturn_def)
    .with(Orbits(sun))
    .with(Sprite, "./assets/saturn.png")
    .spawn()
  let jupiter = make_body(world, jupiter_def)
    .with(Orbits(sun))
    .with(Sprite, "./assets/jupiter.png")
    .spawn()
  make_body(world, io_def).with(Orbits(jupiter)).spawn()
  make_body(world, europa_def).with(Orbits(jupiter)).spawn()
  make_body(world, uranus_def).with(Orbits(sun)).spawn()
  make_body(world, neptune_def).with(Orbits(sun)).spawn()
  make_body(world, pluto_def).with(Orbits(sun)).spawn()
}

let click_bodies: App.System = world => {
  let commands = world.get_resource(Commands.res)
  document.addEventListener("click", e => {
    let x = to_world_x(e.clientX * dpr) - canvas.width / 2
    let y = to_world_y(e.clientY * dpr) - canvas.height / 2
    world.for_each(bodies, (position, radius, entity) => {
      let dx = position.x - x
      let dy = position.y - y
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        let step = world.get_resource(Timestep.res).step()
        let command = Commands.despawn(entity, step)
        commands.insert(command)
        return false
      }
    })
  })
}

let update_pointer: App.System = world => {
  let pointer = world.get_resource(Pointer)
  let on_pointermove = (e: MouseEvent) => {
    pointer.x = to_world_x(e.clientX * dpr) - canvas.width / 2
    pointer.y = to_world_y(e.clientY * dpr) - canvas.height / 2
  }
  document.addEventListener("pointermove", on_pointermove, {
    passive: true,
  })
}

let toggle_cursor: App.System = world => {
  let pointer = world.get_resource(Pointer)
  let hit = false
  world.for_each(bodies, (p, r) => {
    let dx = p.x - pointer.x
    let dy = p.y - pointer.y
    if (Math.sqrt(dx * dx + dy * dy) < r) {
      document.body.style = "cursor: pointer"
      hit = true
      return false
    }
  })
  if (!hit) {
    document.body.style = "cursor: default"
  }
}

let solar: App.Plugin = app => {
  app
    .add_resource(Pointer, {x: 0, y: 0})
    .add_effect(log_bodies)
    .add_effect(log_orbits)
    .add_init_system(spawn_bodies)
    .add_init_system(click_bodies)
    .add_init_system(update_pointer)
    .add_system(
      move_satellites,
      System.before(clear_canvas),
      System.when(Timestep.logical),
    )
    .add_system(clear_canvas)
    .add_system(draw_bodies, System.after(clear_canvas))
    .add_system(draw_orbits, System.after(clear_canvas))
    .add_system(toggle_cursor, System.when(Timestep.logical))
}

let game = App.make()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Commands.plugin)
  .use(solar)

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}

loop()
