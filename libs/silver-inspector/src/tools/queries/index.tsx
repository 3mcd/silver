import {useState} from "react"
import * as ecs from "silver-ecs"
import {DebugHighlighted, DebugSelected} from "silver-lib"
import {QueryDef} from "../../context/query_context"
import {useWorld} from "../../hooks/use_world"
import {Entity} from "../../pages/entity"
import {Query} from "./query"
import {QueryList} from "./query_list"

type State =
  | {mode: "queries"}
  | {mode: "query"; query: QueryDef}
  | {mode: "entity"; query: QueryDef; entity: ecs.Entity}

export let Queries = () => {
  const [state, setState] = useState<State>({mode: "queries"})
  let world = useWorld()
  switch (state.mode) {
    case "queries":
      return (
        <QueryList
          onQuerySelected={query => setState({mode: "query", query})}
        />
      )
    case "query":
      return (
        <Query
          query={state.query}
          onBack={() => setState({mode: "queries"})}
          onEntitySelected={(entity, select) => {
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
              setState({mode: "entity", query: state.query, entity})
            }
          }}
          onEntityHoverIn={entity => {
            if (!world.has(entity, DebugHighlighted)) {
              world.add(entity, DebugHighlighted)
            }
          }}
          onEntityHoverOut={entity => {
            if (world.has(entity, DebugHighlighted)) {
              world.remove(entity, DebugHighlighted)
            }
          }}
        />
      )
    case "entity":
      return (
        <Entity
          entity={state.entity}
          onBack={() => setState({mode: "query", query: state.query})}
          onEntitySelected={() => {}}
        />
      )
  }
}
