import * as ecs from "silver-ecs"
import * as lib from "silver-lib"
import {Mesh} from "silver-r3f"

export let Player = ecs.type(Mesh, lib.Position, lib.Velocity)
