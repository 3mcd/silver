import {useContext} from "react"
import * as ecs from "silver-ecs"
import {queryContext} from "../context/query_context"
import {useNode} from "./use_graph"

export let useQueries = () => {
  return useContext(queryContext)
}

export let useQuery = (query: ecs.Query) => {
  useNode(query.node)
  let matches: ecs.Entity[] = []
  query.each(entity => {
    matches.push(entity)
  })
  return matches
}
