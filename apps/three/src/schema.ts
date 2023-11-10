import {type} from "silver-ecs"
import {Velocity} from "silver-lib"
import {Instance, Mesh} from "silver-three"

export const Box = type(Instance, Velocity)
export const Sphere = type(Mesh, Velocity)
