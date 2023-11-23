import {ColliderDesc} from "@dimforge/rapier3d"
import {Entity, System} from "silver-ecs"
import {
  AngularVelocity,
  Kinetic,
  LinearVelocity,
  Name,
  Position,
  Rotation,
  Scale,
  Transform,
} from "silver-lib"
import {Collider} from "silver-rapier"
import {
  ThreeCamera,
  CastsShadow,
  Instance,
  InstanceCount,
  ThreeLight,
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
  SphereGeometry,
  Vector3,
} from "three"
import {Sky} from "three/examples/jsm/objects/Sky"

const boxGeometry = new BoxGeometry()
const boxMaterial = new MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1,
  roughness: 0.5,
})
const boxColliderDesc = ColliderDesc.cuboid(0.5, 0.5, 0.5).setRestitution(0.6)

const sunlight = new DirectionalLight(0xfdfbd3, 5)
sunlight.castShadow = true
sunlight.shadow.camera.near = 0.1
sunlight.shadow.camera.far = 1000
sunlight.shadow.camera.top = 100
sunlight.shadow.camera.left = -100
sunlight.shadow.camera.bottom = -100
sunlight.shadow.camera.right = 100
sunlight.shadow.mapSize.width = 2048
sunlight.shadow.mapSize.height = 2048

export const spawnSystem: System = world => {
  const n = 20
  const boxCount = Math.pow(n, 2)

  // terrain
  world
    .with(Mesh, new BoxGeometry(200, 1, 200), new MeshStandardMaterial())
    .with(Transform, Position.make(0, -10, 0), Rotation.make())
    .with(Collider, ColliderDesc.cuboid(100, 0.5, 100))
    .with(ReceivesShadow)
    .spawn()

  // box instanced mesh
  const instanced = world
    .with(Mesh, boxGeometry, boxMaterial)
    .with(InstanceCount, boxCount)
    .with(CastsShadow)
    .with(ReceivesShadow)
    .spawn()

  // box instances
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      world
        .with(Instance, instanced)
        .with(Transform, Position.make(j * 2 - n, i * 2, 0), Rotation.make())
        .with(Collider, boxColliderDesc)
        .with(Kinetic, LinearVelocity.make(), AngularVelocity.make())
        .with(Scale, Scale.make(((i + 1) * (j + 1)) / boxCount))
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
  sun.multiplyScalar(100)
  sky.material.uniforms.sunPosition.value.copy(sun)
  world
    .with(Mesh, sky.geometry, sky.material)
    .with(Scale, Scale.make(450_000))
    .spawn()

  // sunlight
  world.with(ThreeLight, sunlight).with(Transform, sun, Rotation.make()).spawn()

  // ambient light
  world.with(ThreeLight, new AmbientLight(0xfdfbd3, 0.2)).spawn()

  // camera
  world
    .with(
      ThreeCamera,
      new PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2_000_000,
      ),
    )
    .with(Transform, Position.make(0, 0, -50), Rotation.make())
    .spawn()

  let balls: Entity[] = []

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      let ball = world
        .with(
          Mesh,
          new SphereGeometry(0.5, 32, 32),
          new MeshStandardMaterial({color: 0xffffff}),
        )
        .with(
          Transform,
          Position.make(i * 2 - 5, j * 2 - 5, 0),
          Rotation.make(),
        )
        .with(Collider, ColliderDesc.ball(0.5))
        .with(Name, `ball-${i}-${j}`)
        .with(CastsShadow)
        .with(ReceivesShadow)
        .spawn()
      balls.push(ball)
    }
  }

  return () => {
    if (world.tick === 500) {
      for (let i = 0; i < balls.length; i++) {
        world.add(
          balls[i],
          Kinetic,
          LinearVelocity.make(),
          AngularVelocity.make(),
        )
      }
    }
  }
}
