import {make, run} from "silver-ecs"
import {makeAliases} from "silver-hammer"
import {
  AngularVelocity,
  DebugSelected,
  LinearVelocity,
  Position,
  Rotation,
  Scale,
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

const aliases = makeAliases()
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
    <Hammer world={world} aliases={aliases} />
  </React.StrictMode>,
)
