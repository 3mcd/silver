import * as rapier from "@dimforge/rapier3d"
import * as S from "silver-ecs"
import {Kinetic, Transform} from "silver-lib"

export let Collider = S.value<rapier.ColliderDesc>({shape: {type: "u8"}})
export let Body = S.type(Collider, Transform)
export let RigidBody = S.type(Body, Kinetic)
