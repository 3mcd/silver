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
  let rapier_world = new World({x: 0.0, y: -9.81, z: 0.0})
  let dynamic_bodies = query(world, RigidBody)
  let dynamic_bodies_in = query(world, RigidBody, In())
  let fixed_bodies_in = query(world, Body, In(), Not(RigidBody))
  let handles_by_entity = SparseMap.make<RigidBodyHandle>()
  let scale_collider_desc = (collider_desc: ColliderDesc, scale: Scale) => {
    switch (collider_desc.shape.type) {
      case ShapeType.Cuboid: {
        let shape = collider_desc.shape as Cuboid
        return ColliderDesc.cuboid(
          shape.halfExtents.x * scale.x,
          shape.halfExtents.y * scale.y,
          shape.halfExtents.z * scale.z,
        ).setRestitution(collider_desc.restitution)
      }
      case ShapeType.Ball: {
        let shape = collider_desc.shape as Ball
        return ColliderDesc.ball(shape.radius * scale.x)
      }
      case ShapeType.Capsule: {
        let shape = collider_desc.shape as Capsule
        return ColliderDesc.capsule(
          shape.halfHeight * scale.y,
          shape.radius * scale.x,
        )
      }
    }
  }
  return () => {
    fixed_bodies_in.each((entity, collider_desc, position, rotation) => {
      let rigid_body_desc = RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(rotation)
      let rigid_body = rapier_world.createRigidBody(rigid_body_desc)
      if (world.has(entity, Scale)) {
        collider_desc = scale_collider_desc(
          collider_desc,
          world.get(entity, Scale),
        )!
      }
      SparseMap.set(handles_by_entity, entity, rigid_body.handle)
      rapier_world.createCollider(collider_desc, rigid_body)
    })
    dynamic_bodies_in.each(
      (entity, collider_desc, position, rotation, velocity) => {
        let rigid_body_desc = RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
          .setRotation(rotation)
          .setLinvel(velocity.x, velocity.y, velocity.z)
        let rigid_body = rapier_world.createRigidBody(rigid_body_desc)
        if (world.has(entity, Scale)) {
          collider_desc = scale_collider_desc(
            collider_desc,
            world.get(entity, Scale),
          )!
        }
        SparseMap.set(handles_by_entity, entity, rigid_body.handle)
        rapier_world.createCollider(collider_desc, rigid_body)
      },
    )
    rapier_world.step()
    dynamic_bodies.each(
      (entity, _, position, rotation, velocity, angular_velocity) => {
        let handle = SparseMap.get(handles_by_entity, entity)
        if (handle) {
          let rigid_body = rapier_world.getRigidBody(handle)
          Object.assign(position, rigid_body.translation())
          Object.assign(rotation, rigid_body.rotation())
          // TODO: These might not be necessary.
          // Object.assign(velocity, rigid_body.linvel())
          // Object.assign(angular_velocity, rigid_body.angvel())
        }
      },
    )
  }
}
