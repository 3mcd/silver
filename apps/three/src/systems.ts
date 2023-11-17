import {ColliderDesc} from "@dimforge/rapier3d"
import {System} from "silver-ecs"
import {
  AngularVelocity,
  Kinetic,
  LinearVelocity,
  Position,
  Rotation,
  Transform,
  Scale,
} from "silver-lib"
import {Collider} from "silver-rapier"
import {
  Camera,
  CastsShadow,
  Instance,
  Instanced,
  Light,
  Mesh,
  ReceivesShadow,
} from "silver-three"
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  MathUtils,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from "three"
import {Sky} from "three/examples/jsm/objects/Sky"

const boxGeometry = new BoxGeometry(1, 1, 1)
const boxMaterial = new MeshStandardMaterial({
  color: 0x049ef4,
  metalness: 1,
  roughness: 0.5,
})

const sunlight = new DirectionalLight(0xfdfbd3, 5)
sunlight.castShadow = true
sunlight.shadow.camera.near = 0.1
sunlight.shadow.camera.far = 1000
sunlight.shadow.camera.top = 100
sunlight.shadow.camera.left = -100
sunlight.shadow.camera.bottom = -100
sunlight.shadow.camera.right = 100
sunlight.shadow.mapSize.width = 2048 * 2
sunlight.shadow.mapSize.height = 2048 * 2

const cubeColliderDesc = ColliderDesc.cuboid(0.5, 0.5, 0.5)

export const spawnSystem: System = world => {
  const n = 40
  const boxCount = n / 2 + Math.pow(n, 2) / 2

  // terrain
  world
    .with(
      Mesh,
      new BoxGeometry(100, 0.1, 100),
      new MeshStandardMaterial({color: 0xffffff}),
    )
    .with(Transform, Position.make(0, -10, 0), Rotation.make())
    .with(Collider, ColliderDesc.cuboid(50, 0.05, 50))
    .with(ReceivesShadow)
    .with(Scale, Scale.make(0.5, 0.5, 0.5))
    .spawn()

  // box instanced mesh
  const instanced = world
    .with(Instanced, boxGeometry, boxMaterial, boxCount)
    .with(CastsShadow)
    .with(ReceivesShadow)
    .spawn()

  // box instances
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      world
        .with(Instance, instanced)
        .with(Transform, Position.make(j * 2 - n, i * 2, 0), Rotation.make())
        .with(Collider, cubeColliderDesc)
        .with(Kinetic, LinearVelocity.make(), AngularVelocity.make())
        .with(
          Scale,
          Scale.make(0.5 + j / n, 0.5 + i / n, 0.5 + (i + j) / 2 / n),
        )
        .spawn()
    }
  }

  // sky
  const sky = new Sky()
  const sun = new Vector3()
  sun.setFromSphericalCoords(
    1,
    MathUtils.degToRad(90 - 2),
    MathUtils.degToRad(180),
  )
  sky.material.uniforms.sunPosition.value.copy(sun)
  world
    .with(Mesh, sky.geometry, sky.material)
    .with(Scale, Scale.make(450_000))
    .spawn()

  // sunlight
  world
    .with(Light, sunlight)
    .with(Transform, sun.multiplyScalar(100), Rotation.make())
    .spawn()

  // ambient light
  world.with(Light, new AmbientLight(0xfdfbd3, 0.2)).spawn()

  // camera
  world
    .with(
      Camera,
      new PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000000,
      ),
    )
    .with(Transform, Position.make(0, 0, -100), Rotation.make())
    .spawn()

  return () => {}
}
