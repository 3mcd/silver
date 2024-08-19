import {useContext} from "react"
import * as S from "silver-ecs"
import {queryContext} from "../context/query_context"
import {useNode} from "./use_graph"

export let useQueries = () => {
  return useContext(queryContext)
}

export let useQuery = (query: S.Query) => {
  useNode(query.node)
  let matches: S.Entity[] = []
  query.for_each(entity => {
    matches.push(entity)
  })
  return matches
}
