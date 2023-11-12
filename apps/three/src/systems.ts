import {ColliderDesc} from "@dimforge/rapier3d"
import {Entity, Init, System, type} from "silver-ecs"
import {AngularVelocity, LinearVelocity, Position, Rotation} from "silver-lib"
import {
  Camera,
  CastsShadow,
  InstancedMesh,
  Light,
  Mesh,
  ReceivesShadow,
} from "silver-three"
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  MathUtils,
  MeshLambertMaterial,
  PerspectiveCamera,
  SphereGeometry,
  Vector3,
} from "three"
import {Sky} from "three/examples/jsm/objects/Sky"
import {Sphere, SphereInstance, Terrain} from "./schema"

const sphereGeometry = new SphereGeometry(0.5)
const sphereMaterial = new MeshLambertMaterial({color: 0xffff00})

const makeSunlight = (sun: Vector3): Init<typeof Light> => {
  const light = new DirectionalLight(0xfdfbd3, 5)
  light.castShadow = true
  light.shadow.camera.near = 0.1
  light.shadow.camera.far = 10000
  light.shadow.camera.top = 200
  light.shadow.camera.left = -200
  light.shadow.camera.bottom = -200
  light.shadow.camera.right = 200
  light.shadow.mapSize.width = 2048
  light.shadow.mapSize.height = 2048
  return [light, sun.multiplyScalar(1000), Rotation.make(), 1]
}

const makeSky = (sun: Vector3): Init<typeof Mesh> => {
  const sky = new Sky()
  sky.scale.setScalar(450_000)
  sky.material.uniforms.sunPosition.value.copy(sun)
  return [sky.geometry, sky.material, Position.make(), Rotation.make(), 450_000]
}

const makeGround = (): Init<typeof Terrain> => {
  return [
    new BoxGeometry(10_000, 1, 10_000),
    new MeshLambertMaterial({color: 0xffffff}),
    Position.make(0, -10, 0),
    Rotation.make(),
    1,
    ColliderDesc.cuboid(5000, 0.5, 5000),
  ]
}

const makeSphere = (
  x: number,
  y: number,
  z: number,
  instanceOf: Entity,
): Init<typeof SphereInstance> => {
  return [
    Position.make(x, y, z),
    Rotation.make(),
    1,
    instanceOf,
    ColliderDesc.ball(0.5),
    LinearVelocity.make(),
    AngularVelocity.make(),
  ]
}

export const spawnSystem: System = world => {
  const sun = new Vector3()
  sun.setFromSphericalCoords(
    1,
    MathUtils.degToRad(90 - 1),
    MathUtils.degToRad(180),
  )
  const n = 50
  const instanced = world.spawn(
    type(InstancedMesh, CastsShadow, ReceivesShadow),
    sphereGeometry,
    sphereMaterial,
    Position.make(),
    Rotation.make(),
    1,
    n / 2 + Math.pow(n, 2) / 2,
  )
  let k = 0
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      k++
      world.spawn(SphereInstance, ...makeSphere(j * 2 - n, i * 2, 0, instanced))
    }
  }
  world.spawn(Terrain, ...makeGround())
  world.spawn(Light, ...makeSunlight(sun))
  world.spawn(Mesh, ...makeSky(sun))
  world.spawn(
    Light,
    new AmbientLight(0xffffff, 0.1),
    Position.make(),
    Rotation.make(),
    1,
  )
  world.spawn(
    Camera,
    new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000000,
    ),
    Position.make(0, 0, -100),
    Rotation.make(),
    1,
  )
  return () => {
    if (world.tick === 1000) {
      world.spawn(
        Sphere,
        sphereGeometry,
        sphereMaterial,
        Position.make(Math.random() * n, Math.random() * n + 100),
        Rotation.make(),
        1,
        ColliderDesc.ball(0.5),
        LinearVelocity.make(),
        AngularVelocity.make(),
      )
    }
  }
}
