import {Not, make, query, run} from "silver-ecs"
import {makeDebugAliases} from "silver-hammer"
import {
  AngularVelocity,
  DebugSelected,
  Kinetic,
  LinearVelocity,
  Position,
  Rotation,
  Scale,
  Transform,
} from "silver-lib"
import {Collider, rapier3dSystem} from "silver-rapier"
import {
  CastsShadow,
  ReceivesShadow,
  ThreeGeometry,
  ThreeLight,
  ThreeMaterial,
  ThreePerspectiveCamera,
  threeSystem,
  InstanceOf,
  InstanceCount,
  IsInstance,
  Mesh,
  Instanced,
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
import Hammer from "silver-hammer/app"

const aliases = makeDebugAliases()
  .set(ThreePerspectiveCamera, "Camera")
  .set(ThreeLight, "Light")
  .set(ThreeGeometry, "Geometry")
  .set(ThreeMaterial, "Material")
  .set(CastsShadow, "CastsShadow")
  .set(ReceivesShadow, "ReceivesShadow")
  .set(Scale, "Scale")
  .set(Collider, "Collider")
  .set(Position, "Position")
  .set(Rotation, "Rotation")
  .set(LinearVelocity, "LinearVelocity")
  .set(AngularVelocity, "AngularVelocity")
  .set(IsInstance, "IsInstance")
  .set(InstanceOf, "InstanceOf")
  .set(InstanceCount, "InstanceCount")
  .set(DebugSelected, "DebugSelected")

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Hammer
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
