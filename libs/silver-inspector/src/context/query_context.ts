import {createContext} from "react"
import * as S from "silver-ecs"

export type QueryDef = {name: string; query: S.Query}
export type QueryDefs = QueryDef[]

export let queryContext = createContext<QueryDefs>(null!)
