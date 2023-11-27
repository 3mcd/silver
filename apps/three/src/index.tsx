import * as S from "silver-ecs"
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

const world = S.makeWorld()
const loop = () => {
  requestAnimationFrame(loop)
  world.step()
  S.run(world, spawnSystem)
  S.run(world, rapier3dSystem)
  S.run(world, threeSystem)
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
      Lights: S.query(world, ThreeLight),
      Cameras: S.query(world, ThreeCamera),
      Boxes: S.query(world, IsInstance),
      Balls: S.query(
        world,
        S.type(Transform, Collider, Kinetic),
        S.Not(InstanceOf),
      ),
      Static: S.query(world, S.type(Transform, Collider), S.Not(Kinetic)),
    }}
  />,
)
