import {Serde} from "silver-ecs/net"
import {Test} from "./plugins/test"

export let serde = Serde.make().add(Test)
