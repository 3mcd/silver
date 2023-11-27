import {In, Out, System, make, query, run, type} from "silver-ecs"
import {
  Click,
  arc,
  canvas,
  circle,
  clear,
  clicks,
  context,
  rect,
  transform,
} from "./canvas"
import {Name} from "silver-lib"
import {Body, Color, Orbits, Position, Radius, seed} from "./data"
import {makeDebugAliases, mount} from "silver-inspector"
import {DebugHighlighted, DebugSelected} from "silver-lib"

const world = make()
seed(world)

const FONT_SIZE = 12 * window.devicePixelRatio

const moveBodiesSystem: System = world => {
  const bodies = query(world, Position)
  const satellites = query(world, type(Position, Orbits))
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

const drawBodiesSystem: System = world => {
  const bodies = query(world, Body)
  return function drawBodies() {
    context.save()
    context.font = `${FONT_SIZE * transform.scale}px monospace`
    context.translate(canvas.width / 2, canvas.height / 2)
    bodies.each(function drawBody(_, name, color, radius, position) {
      context.save()
      context.translate(position.x, position.y)
      circle(color, radius)
      context.fillStyle = "#ccc"
      context.fillText(name, radius + 2, radius + 2)
      context.restore()
    })
    context.restore()
  }
}

const drawOrbitsSystem: System = world => {
  const bodies = query(world, Position)
  const satellites = query(world, Orbits)
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

const clearCanvasSystem: System = () => {
  return function clearCanvas() {
    clear()
  }
}

const debugSystem: System = world => {
  const highlighted = query(world, type(Position, Radius, DebugHighlighted))
  const selected = query(world, type(Position, Radius, DebugSelected))
  return function debug() {
    context.save()
    context.translate(canvas.width / 2, canvas.height / 2)
    highlighted.each(function highlightEntity(entity, position, radius) {
      context.save()
      context.translate(position.x - radius, position.y - radius)
      rect("#ffffff", radius * 2, radius * 2, 1)
      context.restore()
    })
    selected.each(function selectEntity(entity, position, radius) {
      context.save()
      context.translate(position.x - radius, position.y - radius)
      rect("#00ff00", radius * 2, radius * 2, 1)
      context.restore()
    })
    context.restore()
  }
}

const loop = () => {
  world.step()
  run(world, moveBodiesSystem)
  run(world, clearCanvasSystem)
  run(world, drawOrbitsSystem)
  run(world, drawBodiesSystem)
  run(world, debugSystem)
  requestAnimationFrame(loop)
}

loop()

mount(
  world,
  document.getElementById("inspector")!,
  makeDebugAliases()
    .set(Name, "Name")
    .set(Color, "Color")
    .set(Position, "Position")
    .set(Orbits, "Orbits")
    .set(Radius, "Radius")
    .set(Body, "Body"),
  {
    bodies: query(world, Body),
  },
)
