import {
  Ball,
  Capsule,
  ColliderDesc,
  Cuboid,
  ShapeType,
  type RigidBodyHandle,
} from "@dimforge/rapier3d"
import {In, Not, SparseMap, System, query} from "silver-ecs"
import {Scale} from "silver-lib"
import {Body, RigidBody} from "./schema"

import {RigidBodyDesc, World} from "@dimforge/rapier3d"

export let rapier3dSystem: System = world => {
  let rapierWorld = new World({x: 0.0, y: -9.81, z: 0.0})
  let dynamicBodies = query(world, RigidBody)
  let dynamicBodiesIn = query(world, RigidBody, In())
  let fixedBodiesIn = query(world, Body, In(), Not(RigidBody))
  let handlesByEntity = SparseMap.make<RigidBodyHandle>()
  let scaleColliderDesc = (colliderDesc: ColliderDesc, scale: Scale) => {
    switch (colliderDesc.shape.type) {
      case ShapeType.Cuboid: {
        let shape = colliderDesc.shape as Cuboid
        return ColliderDesc.cuboid(
          shape.halfExtents.x * scale.x,
          shape.halfExtents.y * scale.y,
          shape.halfExtents.z * scale.z,
        ).setRestitution(colliderDesc.restitution)
      }
      case ShapeType.Ball: {
        let shape = colliderDesc.shape as Ball
        return ColliderDesc.ball(shape.radius * scale.x)
      }
      case ShapeType.Capsule: {
        let shape = colliderDesc.shape as Capsule
        return ColliderDesc.capsule(
          shape.halfHeight * scale.y,
          shape.radius * scale.x,
        )
      }
    }
  }
  return () => {
    fixedBodiesIn.each((entity, colliderDesc, position, rotation) => {
      let rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(rotation)
      let rigidBody = rapierWorld.createRigidBody(rigidBodyDesc)
      if (world.has(entity, Scale)) {
        colliderDesc = scaleColliderDesc(
          colliderDesc,
          world.get(entity, Scale),
        )!
      }
      SparseMap.set(handlesByEntity, entity, rigidBody.handle)
      rapierWorld.createCollider(colliderDesc, rigidBody)
    })
    dynamicBodiesIn.each(
      (entity, colliderDesc, position, rotation, velocity) => {
        let rigidBodyDesc = RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
          .setRotation(rotation)
          .setLinvel(velocity.x, velocity.y, velocity.z)
        let rigidBody = rapierWorld.createRigidBody(rigidBodyDesc)
        if (world.has(entity, Scale)) {
          colliderDesc = scaleColliderDesc(
            colliderDesc,
            world.get(entity, Scale),
          )!
        }
        SparseMap.set(handlesByEntity, entity, rigidBody.handle)
        rapierWorld.createCollider(colliderDesc, rigidBody)
      },
    )
    rapierWorld.step()
    dynamicBodies.each(
      (entity, _, position, rotation, velocity, angularVelocity) => {
        let handle = SparseMap.get(handlesByEntity, entity)
        if (handle) {
          let rigidBody = rapierWorld.getRigidBody(handle)
          let rigidBodyTranslation = rigidBody.translation()
          let rigidBodyRotation = rigidBody.rotation()
          position.x = rigidBodyTranslation.x
          position.y = rigidBodyTranslation.y
          position.z = rigidBodyTranslation.z
          rotation.x = rigidBodyRotation.x
          rotation.y = rigidBodyRotation.y
          rotation.z = rigidBodyRotation.z
          rotation.w = rigidBodyRotation.w
        }
      },
    )
  }
}
