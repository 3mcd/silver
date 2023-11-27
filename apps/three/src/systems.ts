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

const sun = new Vector3()
sun.setFromSphericalCoords(
  1,
  MathUtils.degToRad(90 - 2),
  MathUtils.degToRad(180),
)
sun.multiplyScalar(100)
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
  // terrain
  world
    .with(Name, "terrain")
    .with(Mesh, new BoxGeometry(100, 1, 100), new MeshStandardMaterial())
    .with(Transform, Position.make({y: -10}))
    .with(Collider, ColliderDesc.cuboid(50, 0.5, 50))
    .with(ReceivesShadow)
    .spawn()

  // box instanced mesh
  const nBoxesPerRow = 20
  const nBoxes = Math.pow(nBoxesPerRow, 2)
  const instanced = world
    .with(Name, "box-instanced")
    .with(Mesh, boxGeometry, boxMaterial)
    .with(InstanceCount, nBoxes)
    .with(CastsShadow)
    .with(ReceivesShadow)
    .spawn()

  // box instances
  for (let i = 0; i < nBoxesPerRow; i++) {
    for (let j = 0; j < nBoxesPerRow; j++) {
      const scale = ((i + 1) * (j + 1)) / nBoxes
      world
        .with(Name, `box-${i}-${j}`)
        .with(Instance, instanced)
        .with(Transform, Position.make({x: j * 2 - nBoxesPerRow, y: i * 2}))
        .with(Collider, boxColliderDesc)
        .with(Kinetic)
        .with(Scale, Scale.make({x: scale, y: scale, z: scale}))
        .spawn()
    }
  }

  // sky
  const {geometry: skyGeometry, material: skyMaterial} = new Sky()
  skyMaterial.uniforms.sunPosition.value.copy(sun)
  world
    .with(Name, "sky")
    .with(Mesh, skyGeometry, skyMaterial)
    .with(Scale, Scale.make({x: 450_000, y: 450_000, z: 450_000}))
    .spawn()

  // sunlight
  world
    .with(ThreeLight, sunlight)
    .with(Name, "sunlight")
    .with(Transform, sun)
    .spawn()

  // ambient light
  world
    .with(Name, "ambient-light")
    .with(ThreeLight, new AmbientLight(0xfdfbd3, 0.2))
    .spawn()

  // camera
  world
    .with(Name, "camera")
    .with(
      ThreeCamera,
      new PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2_000_000,
      ),
    )
    .with(Transform, Position.make({z: -50}))
    .spawn()

  const balls: Entity[] = []
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const ball = world
        .with(Name, `ball-${i}-${j}`)
        .with(
          Mesh,
          new SphereGeometry(0.5, 32, 32),
          new MeshStandardMaterial({color: 0xffffff}),
        )
        .with(Transform, Position.make({x: i * 2 - 5, y: j * 2 - 5, z: 0}))
        .with(Collider, ColliderDesc.ball(0.5))
        .with(CastsShadow)
        .with(ReceivesShadow)
        .spawn()
      balls.push(ball)
    }
  }

  return () => {
    // Add physics to balls after 500 steps.
    if (world.tick === 500) {
      for (let i = 0; i < balls.length; i++) {
        world.add(balls[i], Kinetic)
      }
    }
  }
}
