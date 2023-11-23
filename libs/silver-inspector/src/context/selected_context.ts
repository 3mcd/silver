import {createContext} from "react"
import {Entity} from "silver-ecs"

export let selectedContext = createContext<Entity[]>([])
