import * as ecs from "silver-ecs"
import * as lib from "silver-lib"
import {Mesh} from "silver-three"

export let Player = ecs.type(Mesh, lib.Velocity)
