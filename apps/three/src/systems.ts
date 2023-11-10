import {Is, System, query, type} from "silver-ecs"
import {Position, Rotation, Velocity} from "silver-lib"
import {Camera, Instanced, Light} from "silver-three"
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  MeshLambertMaterial,
  PerspectiveCamera,
  SphereGeometry,
} from "three"
import {Box, Sphere} from "./schema"

export const spawnSystem: System = world => {
  const n = 10
  const material = new MeshLambertMaterial({color: 0x00ff00})
  const geometry = new BoxGeometry(1, 1, 1)
  const instanced = world.spawn(Instanced, geometry, material, Math.pow(n, 3))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        if (Math.random() > 0.8) {
          world.spawn(
            Sphere,
            new SphereGeometry(0.5),
            new MeshLambertMaterial({color: 0x00ffff}),
            Position.make(i * 2, j * 2, k * 2),
            Rotation.make(),
            Velocity.make(),
          )
        } else {
          world.spawn(
            Box,
            Position.make(i * 2, j * 2, k * 2),
            Rotation.make(),
            instanced,
            Velocity.make(),
          )
        }
      }
    }
  }
  world.spawn(
    Light,
    new DirectionalLight(0xffffff, 0.5),
    Position.make(0, 1, 5),
    Rotation.make(),
  )
  world.spawn(
    Light,
    new DirectionalLight(0xff0000, 0.1),
    Position.make(0, 1, -5),
    Rotation.make(),
  )
  world.spawn(
    Light,
    new AmbientLight(0x404040),
    Position.make(),
    Rotation.make(),
  )
  world.spawn(
    Camera,
    new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    ),
    Position.make(0, 0, 1),
    Rotation.make(),
  )
  return () => {}
}

export const inputSystem: System = world => {
  const boxes = query(world, Velocity, Is(Box))
  const keys = new Set<string>()
  const on_keydown = (event: KeyboardEvent) => {
    keys.add(event.key)
  }
  const on_keyup = (event: KeyboardEvent) => {
    keys.delete(event.key)
  }
  document.addEventListener("keydown", on_keydown)
  document.addEventListener("keyup", on_keyup)
  return () => {
    boxes.each((_, velocity) => {
      let velocityX = 0
      let velocityY = 0
      if (keys.has("ArrowLeft")) velocityX -= 1
      if (keys.has("ArrowRight")) velocityX += 1
      if (keys.has("ArrowUp")) velocityY -= 1
      if (keys.has("ArrowDown")) velocityY += 1
      velocity.x = velocityX
      velocity.y = velocityY
    })
  }
}

export let moveSystem: System = world => {
  let rotate = query(world, Rotation)
  let rotateVelocities: number[] = []
  let move = query(world, type(Position, Velocity))
  return () => {
    move.each((_, position, velocity) => {
      position.x += velocity.x
      position.y += velocity.y
    })
    rotate.each((entity, rotation) => {
      let rotateVelocity = (rotateVelocities[entity] ??= Math.random() * 0.01)
      rotation.x += rotateVelocity
      rotation.z += rotateVelocity
    })
  }
}
