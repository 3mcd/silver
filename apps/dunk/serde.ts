import {Serde} from "silver-ecs/net"
import {Position} from "./plugins/physics/data"
import {IsPlayer} from "./plugins/player/plugin"
import {ClientId} from "silver-ecs/net"

export let serde = Serde.make().add(IsPlayer).add(Position).add(ClientId)
