import * as ecs from "silver-ecs"
import * as three from "three"
import * as lib from "silver-lib"

export const Geometry = ecs.value<three.BufferGeometry>()
export const Material = ecs.value<three.Material>()
export const Mesh = ecs.type(Geometry, Material, lib.Position, lib.Rotation)
export const Instanced = ecs.tag()
