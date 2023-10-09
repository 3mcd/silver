import * as ecs from "silver-ecs/dev"
import {
  Click,
  arc,
  canvas,
  circle,
  clear,
  clicks,
  context,
  transform,
} from "./canvas"
import data from "./data.json"

type Orbit = {radius: number; period: number}
type Position = {x: number; y: number}

const Name = ecs.value<string>()
const Color = ecs.value<string>()
const Radius = ecs.value<number>()
const Orbits = ecs.relation<Orbit>()
const Position = ecs.value<Position>()

const Body = ecs.type(Name, Color, Radius, Position)
const Satellite = ecs.type(Body, Orbits)

const world = ecs.make()
const types = {Body, Satellite} as const
type Data = {[K in keyof typeof types]: ecs.Data<(typeof types)[K]>[]}
const keys = Object.keys(types) as Array<keyof typeof types>
const load = (data: Data) => {
  const entities: Record<string, ecs.Entity> = {}
  for (const key of keys) {
    switch (key) {
      case "Body":
        for (let i = 0; i < data[key].length; i++) {
          const init = data[key][i]
          entities[init[0]] = world.spawn(Body, ...init)
        }
        break
      case "Satellite":
        for (let i = 0; i < data[key].length; i++) {
          const init = data[key][i]
          init[4][0] = entities[init[4][0]]
          entities[init[0]] = world.spawn(Satellite, ...init)
        }
        break
    }
  }
}

load(data as Data)

const FONT_SIZE = 12 * window.devicePixelRatio

const moveBodiesSystem: ecs.System = world => {
  const bodies = ecs.query(world, Position)
  const satellites = ecs.query(world, ecs.type(Position, Orbits))
  return function moveBodies() {
    bodies.each(function moveBodySatellites(body, bodyPos) {
      satellites.each(body, function moveBodySatellite(_, satellitePos, orbit) {
        let {radius, period} = orbit
        const a = ((Math.PI / 180) * world.tick * period) / 100
        radius *= 1_000
        satellitePos.x = bodyPos.x + radius * Math.cos(a)
        satellitePos.y = bodyPos.y + radius * Math.sin(a)
      })
    })
  }
}

const drawBodiesSystem: ecs.System = world => {
  const bodies = ecs.query(world, Body)
  return function drawBodies() {
    context.save()
    context.font = `${FONT_SIZE * transform.scale}px monospace`
    context.translate(canvas.width / 2, canvas.height / 2)
    bodies.each(function drawBody(_, name, color, radius, position) {
      context.save()
      context.translate(position.x, position.y)
      circle(color, 1 * radius)
      if (DEBUG) {
        context.fillStyle = "#666"
        context.fillText(_.toString(), -radius - 20, -radius - 20)
      }
      context.fillStyle = "#ccc"
      context.fillText(name, radius + 2, radius + 2)
      context.restore()
    })
    context.restore()
  }
}

const drawOrbitsSystem: ecs.System = world => {
  const bodies = ecs.query(world, Position)
  const satellites = ecs.query(world, Orbits)
  return function drawBodiesOrbits() {
    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    bodies.each(function drawBodyOrbits(body, position) {
      context.save()
      context.translate(position.x, position.y)
      satellites.each(body, function drawBodySatelliteOrbit(_, orbit) {
        arc("#bbb", orbit.radius * 1_000, 0, 2 * Math.PI, 0.1)
      })
      context.restore()
    })
    context.restore()
  }
}

const processInputsSystem: ecs.System = world => {
  const bodies = ecs.query(world, ecs.type(Position, Radius))
  return function processInputs() {
    let click: Click | undefined
    while ((click = clicks.pop())) {
      bodies.each(function maybeDespawnBody(body, position, radius) {
        const dx = click!.x - position.x
        const dy = click!.y - position.y
        if (Math.sqrt(dx * dx + dy * dy) < radius) {
          world.despawn(body)
        }
      })
    }
  }
}

const clearCanvasSystem: ecs.System = () => {
  return function clearCanvas() {
    clear()
  }
}

const debugSystem: ecs.System = world => {
  const spawned = ecs.query(world, ecs.Any, ecs.In(ecs.Any))
  const despawned = ecs.query(world, ecs.Any, ecs.Out(ecs.Any))
  return function emitDebugMessages() {
    spawned.each(function logSpawnedEntity(entity) {
      console.log("spawned", entity)
    })
    despawned.each(function logDespawnedEntity(entity) {
      console.log("despawned", entity)
    })
  }
}

const loop = () => {
  world.step()
  ecs.run(world, processInputsSystem)
  ecs.run(world, moveBodiesSystem)
  ecs.run(world, clearCanvasSystem)
  ecs.run(world, drawOrbitsSystem)
  ecs.run(world, drawBodiesSystem)
  ecs.run(world, debugSystem)
  requestAnimationFrame(loop)
}

loop()
