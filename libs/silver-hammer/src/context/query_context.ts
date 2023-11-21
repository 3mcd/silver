import {createContext} from "react"
import {Query} from "silver-ecs"

export type Queries = {name: string; query: Query}[]

export let queryContext = createContext<Queries>(null!)
