import {make, run} from "silver-ecs"
import {aliases, mount} from "silver-hammer"
import {
  AngularVelocity,
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

mount(
  world,
  document.getElementById("root")!,
  aliases()
    .add(ThreePerspectiveCamera, "cam")
    .add(ThreeLight, "light")
    .add(ThreeGeometry, "geom")
    .add(ThreeMaterial, "mat")
    .add(CastsShadow, "cast_shdw")
    .add(ReceivesShadow, "recv_shdw")
    .add(Scale, "s")
    .add(Collider, "col")
    .add(Position, "pos")
    .add(Rotation, "rot")
    .add(LinearVelocity, "vel")
    .add(AngularVelocity, "avel"),
)
