import * as ecs from "silver-ecs"
import * as rapier from "@dimforge/rapier3d"
import {Position, Rotation, LinearVelocity, AngularVelocity} from "silver-lib"

export let Collider = ecs.value<rapier.ColliderDesc>()
export let Body = ecs.type(Collider, Position, Rotation)
export let RigidBody = ecs.type(Body, LinearVelocity, AngularVelocity)
