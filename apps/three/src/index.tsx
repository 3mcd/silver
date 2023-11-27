import {Not, make, query, run, type} from "silver-ecs"
import {makeDebugAliases} from "silver-inspector"
import {Kinetic, Transform} from "silver-lib"
import {Collider, rapier3dSystem} from "silver-rapier"
import {
  CastsShadow,
  InstanceCount,
  InstanceOf,
  IsInstance,
  ReceivesShadow,
  ThreeCamera,
  ThreeGeometry,
  ThreeLight,
  ThreeMaterial,
  threeSystem,
} from "silver-three"
import {spawnSystem} from "./systems"

const world = make()
const loop = () => {
  requestAnimationFrame(loop)
  world.step()
  run(world, spawnSystem)
  run(world, rapier3dSystem)
  run(world, threeSystem)
}

requestAnimationFrame(loop)

import ReactDOM from "react-dom/client"
import Inspector from "silver-inspector/app"

const aliases = makeDebugAliases()
  .set(ThreeCamera, "Camera")
  .set(ThreeLight, "Light")
  .set(ThreeGeometry, "Geometry")
  .set(ThreeMaterial, "Material")
  .set(CastsShadow, "CastsShadow")
  .set(ReceivesShadow, "ReceivesShadow")
  .set(Collider, "Collider")
  .set(IsInstance, "IsInstance")
  .set(InstanceOf, "InstanceOf")
  .set(InstanceCount, "InstanceCount")

if (window.matchMedia) {
  const mode = window.matchMedia("(prefers-color-scheme: dark)")
  const onChange = (event: MediaQueryList | MediaQueryListEvent) =>
    document.documentElement.classList.add(event.matches ? "dark" : "light")
  onChange(mode)
  mode.addEventListener("change", onChange)
}

ReactDOM.createRoot(document.getElementById("inspector")!).render(
  <Inspector
    world={world}
    aliases={aliases}
    queries={{
      Lights: query(world, ThreeLight),
      Cameras: query(world, ThreeCamera),
      Boxes: query(world, IsInstance),
      Balls: query(world, type(Transform, Collider, Kinetic), Not(InstanceOf)),
      Static: query(world, type(Transform, Collider), Not(Kinetic)),
    }}
  />,
)
