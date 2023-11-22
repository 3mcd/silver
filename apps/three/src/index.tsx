import {Not, make, query, run} from "silver-ecs"
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
  ThreePerspectiveCamera,
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

import React from "react"
import ReactDOM from "react-dom/client"
import Inspector from "silver-inspector/app"

const aliases = makeDebugAliases()
  .set(ThreePerspectiveCamera, "Camera")
  .set(ThreeLight, "Light")
  .set(ThreeGeometry, "Geometry")
  .set(ThreeMaterial, "Material")
  .set(CastsShadow, "CastsShadow")
  .set(ReceivesShadow, "ReceivesShadow")
  .set(Collider, "Collider")
  .set(IsInstance, "IsInstance")
  .set(InstanceOf, "InstanceOf")
  .set(InstanceCount, "InstanceCount")

ReactDOM.createRoot(document.getElementById("inspector")!).render(
  <React.StrictMode>
    <Inspector
      world={world}
      aliases={aliases}
      queries={{
        meshes: query(world, Mesh, Not(Instanced)),
        kinetics: query(world, Kinetic),
        transforms: query(world, Transform),
        selected: query(world, DebugSelected),
      }}
    />
  </React.StrictMode>,
)
