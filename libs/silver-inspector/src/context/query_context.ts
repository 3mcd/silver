import {createContext} from "react"
import {Query} from "silver-ecs"

export type QueryDef = {name: string; query: Query}
export type QueryDefs = QueryDef[]

export let queryContext = createContext<QueryDefs>(null!)
