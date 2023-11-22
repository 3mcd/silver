import {useContext, useEffect, useLayoutEffect, useMemo, useState} from "react"
import {queryContext} from "../context/query_context"
import * as ecs from "silver-ecs"
import {useNode} from "./use_graph"

export let useQueries = () => {
  return useContext(queryContext)
}

export let useQuery = (query: ecs.Query) => {
  let [, setVersion] = useState(0)
  let matches = useMemo(() => ecs.SparseSet.make<ecs.Entity>(), [])
  let monitorIn = useMemo(
    () => ecs.query(query.world, query.node.type, ecs.In()),
    [query],
  )
  let monitorOut = useMemo(
    () => ecs.query(query.world, query.node.type, ecs.Out()),
    [query],
  )
  useNode(query.node)
  useEffect(() => {
    let hit = false
    monitorIn.each(entity => {
      ecs.SparseSet.add(matches, entity)
      hit = true
    })
    monitorOut.each(entity => {
      ecs.SparseSet.delete(matches, entity)
      hit = true
    })
    if (hit) {
      setVersion(v => v + 1)
    }
  }, [monitorIn, monitorOut, matches])
  return ecs.SparseSet.values(matches)
}
