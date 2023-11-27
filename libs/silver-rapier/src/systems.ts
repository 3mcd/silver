import {
  Ball,
  Capsule,
  ColliderDesc,
  Cuboid,
  ShapeType,
  type RigidBodyHandle,
} from "@dimforge/rapier3d"
import * as S from "silver-ecs"
import {Scale} from "silver-lib"
import {Body, RigidBody} from "./schema"

import {RigidBodyDesc, World} from "@dimforge/rapier3d"

export let rapier3dSystem: S.System = world => {
  let rapierWorld = new World({x: 0.0, y: -9.81, z: 0.0})
  let dynamicBodies = S.query(world, RigidBody)
  let dynamicBodiesIn = S.query(world, RigidBody, S.In())
  let dynamicBodiesOut = S.query(world, RigidBody, S.Out())
  let fixedBodiesIn = S.query(world, Body, S.In(), S.Not(RigidBody))
  let fixedBodiesOut = S.query(world, Body, S.Out(), S.Not(RigidBody))
  let handlesByEntity = S.SparseMap.make<RigidBodyHandle>()
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
      let handle = S.SparseMap.get(handlesByEntity, entity)
      if (handle !== undefined) {
        rapierWorld.removeRigidBody(rapierWorld.getRigidBody(handle))
      }
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
      S.SparseMap.set(handlesByEntity, entity, rigidBody.handle)
      rapierWorld.createCollider(colliderDesc, rigidBody)
    })
    fixedBodiesOut.each(entity => {
      let handle = S.SparseMap.get(handlesByEntity, entity)
      if (handle !== undefined) {
        rapierWorld.removeRigidBody(rapierWorld.getRigidBody(handle))
      }
    })
    dynamicBodiesIn.each(
      (entity, colliderDesc, position, rotation, velocity) => {
        let handle = S.SparseMap.get(handlesByEntity, entity)
        if (handle !== undefined) {
          rapierWorld.removeRigidBody(rapierWorld.getRigidBody(handle))
        }
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
        S.SparseMap.set(handlesByEntity, entity, rigidBody.handle)
        rapierWorld.createCollider(colliderDesc, rigidBody)
      },
    )
    dynamicBodiesOut.each(entity => {
      let handle = S.SparseMap.get(handlesByEntity, entity)
      if (handle !== undefined) {
        rapierWorld.removeRigidBody(rapierWorld.getRigidBody(handle))
      }
    })
    rapierWorld.step()
    dynamicBodies.each(
      (entity, _, position, rotation, velocity, angularVelocity) => {
        let handle = S.SparseMap.get(handlesByEntity, entity)
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
