import {useCallback, useEffect, useState} from "react"
import * as ecs from "silver-ecs"
import {DebugHighlighted, DebugSelected} from "silver-lib"
import {QueryDef} from "../../context/query_context"
import {useWorld} from "../../hooks/use_world"
import {Entity} from "../entities/entity"
import {Query} from "./query"
import {QueryList} from "./query_list"
import {Assert} from "silver-lib"

type State =
  | {mode: "queries"}
  | {mode: "query"; query: QueryDef}
  | {mode: "entity"; query: QueryDef; entity: ecs.Entity}

export let Queries = () => {
  const [state, setState] = useState<State>({mode: "queries"})
  let world = useWorld()
  let onQuerySelected = useCallback((query: QueryDef) => {
    setState({mode: "query", query})
  }, [])
  let onEntitySelected = useCallback(
    (entity: ecs.Entity, select: boolean) => {
      if (select) {
        if (world.has(entity, DebugSelected)) {
          world.remove(entity, DebugSelected)
        } else {
          world.add(entity, DebugSelected)
        }
      } else {
        if (world.has(entity, DebugHighlighted)) {
          world.remove(entity, DebugHighlighted)
        }
        Assert.ok(state.mode !== "queries")
        setState({mode: "entity", query: state.query, entity})
      }
    },
    [world, state],
  )
  let onEntityHoverIn = useCallback(
    (entity: ecs.Entity) => {
      if (!world.has(entity, DebugHighlighted)) {
        world.add(entity, DebugHighlighted)
      }
    },
    [world],
  )
  let onEntityHoverOut = useCallback(
    (entity: ecs.Entity) => {
      if (world.has(entity, DebugHighlighted)) {
        world.remove(entity, DebugHighlighted)
      }
    },
    [world],
  )
  let onBackEntity = useCallback(() => {
    Assert.ok(state.mode === "entity")
    setState({mode: "query", query: state.query})
  }, [state])
  let onBackQuery = useCallback(() => {
    setState({mode: "queries"})
  }, [])

  switch (state.mode) {
    case "queries":
      return <QueryList onQuerySelected={onQuerySelected} />
    case "query":
      return (
        <Query
          query={state.query}
          onBack={onBackQuery}
          onEntitySelected={onEntitySelected}
          onEntityHoverIn={onEntityHoverIn}
          onEntityHoverOut={onEntityHoverOut}
        />
      )
    case "entity":
      return (
        <Entity
          entity={state.entity}
          onBack={onBackEntity}
          onEntitySelected={onEntitySelected}
        />
      )
  }
}
