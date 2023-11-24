import {Not, make, query, run, type} from "silver-ecs"
import {makeDebugAliases} from "silver-inspector"
import {DebugSelected, Kinetic, Transform} from "silver-lib"
import {Collider, rapier3dSystem} from "silver-rapier"
import {
  CastsShadow,
  InstanceCount,
  InstanceOf,
  Instanced,
  IsInstance,
  Mesh,
  ReceivesShadow,
  ThreeGeometry,
  ThreeLight,
  ThreeMaterial,
  ThreeCamera,
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
  document.documentElement.classList.add(
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  )
}

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", event => {
    document.documentElement.classList.add(event.matches ? "dark" : "light")
  })

ReactDOM.createRoot(document.getElementById("inspector")!).render(
  <Inspector
    world={world}
    aliases={aliases}
    queries={{
      Lights: query(world, ThreeLight),
      Cameras: query(world, ThreeCamera),
      Dynamic: query(world, type(Transform, Collider, Kinetic)),
      "Dynamic non-instance": query(
        world,
        type(Transform, Collider, Kinetic),
        Not(InstanceOf),
      ),
      Static: query(world, type(Transform, Collider), Not(Kinetic)),
    }}
  />,
)
