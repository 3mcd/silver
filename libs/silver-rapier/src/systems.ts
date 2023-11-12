import type {RigidBodyHandle} from "@dimforge/rapier3d"
import {In, Not, SparseMap, System, query} from "silver-ecs"
import {Body, RigidBody} from "./schema"

let {RigidBodyDesc, World} = await import("@dimforge/rapier3d")

export let rapier3dSystem: System = world => {
  let rapier_world = new World({x: 0.0, y: -9.81, z: 0.0})
  let dynamic_bodies = query(world, RigidBody)
  let dynamic_bodies_in = query(world, RigidBody, In())
  let fixed_bodies_in = query(world, Body, In(), Not(RigidBody))
  let handles_by_entity = SparseMap.make<RigidBodyHandle>()
  return () => {
    fixed_bodies_in.each((entity, collider_desc, position, rotation) => {
      let rigid_body_desc = RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(rotation)
      let rigid_body = rapier_world.createRigidBody(rigid_body_desc)
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
