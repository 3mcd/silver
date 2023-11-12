import {type} from "silver-ecs"
import {AngularVelocity, LinearVelocity} from "silver-lib"
import {Collider} from "silver-rapier"
import {CastsShadow, Instance, Mesh, ReceivesShadow} from "silver-three"

export const Sphere = type(
  Mesh,
  Collider,
  LinearVelocity,
  AngularVelocity,
  CastsShadow,
  ReceivesShadow,
)
export const SphereInstance = type(
  Instance,
  CastsShadow,
  ReceivesShadow,
  Collider,
  LinearVelocity,
  AngularVelocity,
)
export const Terrain = type(Mesh, Collider, ReceivesShadow)
