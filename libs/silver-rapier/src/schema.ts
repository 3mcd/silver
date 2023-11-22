import * as rapier from "@dimforge/rapier3d"
import * as ecs from "silver-ecs"
import {Kinetic, Transform} from "silver-lib"

export let Collider = ecs.value<rapier.ColliderDesc>({shape: {type: "u8"}})
export let Body = ecs.type(Collider, Transform)
export let RigidBody = ecs.type(Body, Kinetic)
