import {App, Component, Effect, Entity, Query, System, World} from "silver-ecs"
import {Commands, Time, Timestep} from "silver-ecs/plugins"
import {
  canvas,
  circle,
  clear,
  context,
  transform,
  transform_x,
  transform_y,
} from "./canvas"

let FONT_SIZE = 12 * window.devicePixelRatio

type Position = {x: number; y: number}

export let LocalPosition = Component.ref<Position>({x: "f32", y: "f32"})
export let Position = Component.ref<Position>({x: "f32", y: "f32"})
export let Radius = Component.ref<number>("f32")
export let Angvel = Component.ref<number>("f32")
export let Name = Component.ref<string>("string")
export let Color = Component.ref<string>("string")

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

let satellites = Query.make(LocalPosition)
  .with(Position)
  .with(Angvel)
  .with(Orbits, body => body.with(Position))

let move_satellites: App.System = world => {
  let step = world.get_resource(Timestep.res).step()
  world.for_each(
    satellites,
    (sattelite_local_pos, satellite_pos, satellite_angvel, orbiting_pos, e) => {
      let a = (Math.PI / 180) * step * satellite_angvel
      let cos_a = Math.cos(a)
      let sin_a = Math.sin(a)
      let x = sattelite_local_pos.x * cos_a - sattelite_local_pos.y * sin_a
      let y = sattelite_local_pos.x * sin_a + sattelite_local_pos.y * cos_a
      satellite_pos.x = x + orbiting_pos.x
      satellite_pos.y = y + orbiting_pos.y
    },
  )
}

let bodies = Query.make().with(Name).with(Color).with(Position).with(Radius)

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

// resources
type Pointer = {x: number; y: number}
let Pointer = Component.ref<Pointer>()

// commands
let Despawn = Component.ref<Entity.t>()

// systems
let sun_def = {name: "sun", color: "#ff0", x: 0, y: 0, r: 15, av: 0}
let earth_def = {name: "earth", color: "#00f", x: 130, y: 0, r: 3, av: 1}
let moon_def = {name: "moon", color: "#aaa", x: 5, y: 0, r: 1, av: 5}
let mars_def = {name: "mars", color: "#f00", x: 200, y: 0, r: 4, av: 0.5}
let venus_def = {name: "venus", color: "#f80", x: 100, y: 0, r: 5, av: 1}
let saturn_def = {name: "saturn", color: "#f80", x: 400, y: 0, r: 6, av: 0.05}
let jupiter_def = {name: "jupiter", color: "#955", x: 600, y: 0, r: 8, av: 0.01}

let spawn_bodies: App.System = world => {
  let sun = make_body(world, sun_def).spawn()
  make_body(world, moon_def)
    .with(Orbits(make_body(world, earth_def).with(Orbits(sun)).spawn()))
    .spawn()
  make_body(world, venus_def).with(Orbits(sun)).spawn()
  make_body(world, mars_def).with(Orbits(sun)).spawn()
  make_body(world, saturn_def).with(Orbits(sun)).spawn()
  make_body(world, jupiter_def).with(Orbits(sun)).spawn()
}

let click_bodies: App.System = world => {
  let commands = world.get_resource(Commands.res)
  document.addEventListener("click", e => {
    let x = transform_x(e.clientX) - canvas.width / 2
    let y = transform_y(e.clientY) - canvas.height / 2
    world.for_each(bodies, (_, __, p, r, entity) => {
      let dx = p.x - x
      let dy = p.y - y
      if (Math.sqrt(dx * dx + dy * dy) < r) {
        let step = world.get_resource(Timestep.res).step()
        let command = Commands.make_command(Despawn, entity, step)
        commands.insert(command)
        return Query.exit
      }
    })
  })
}

let update_pointer: App.System = world => {
  let pointer = world.get_resource(Pointer)
  let on_pointermove = (e: MouseEvent) => {
    pointer.x = transform_x(e.clientX) - canvas.width / 2
    pointer.y = transform_y(e.clientY) - canvas.height / 2
  }
  document.addEventListener("pointermove", on_pointermove, {
    passive: true,
  })
}

let despawn_bodies: App.System = world => {
  let timestep = world.get_resource(Timestep.res)
  let commands = world.get_resource(Commands.res)
  let step = timestep.step()
  commands.read(Despawn, step, command => {
    world.despawn(command.data)
  })
}

let toggle_cursor: App.System = world => {
  let pointer = world.get_resource(Pointer)
  let hit = false
  world.for_each(bodies, (_, __, p, r) => {
    let dx = p.x - pointer.x
    let dy = p.y - pointer.y
    if (Math.sqrt(dx * dx + dy * dy) < r) {
      document.body.style = "cursor: pointer"
      hit = true
      return Query.exit
    }
  })
  if (!hit) {
    document.body.style = "cursor: default"
  }
}

let game = App.make()
  .use(Time.plugin)
  .use(Timestep.plugin)
  .use(Commands.plugin)
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
  .add_system(despawn_bodies, System.when(Commands.read))
  .add_system(toggle_cursor, System.when(Timestep.logical))

let loop = () => {
  game.run()
  requestAnimationFrame(loop)
}

loop()
