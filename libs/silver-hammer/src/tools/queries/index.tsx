import {useState} from "react"
import {Text} from "../../components/text"
import {QueryDef} from "../../context/query_context"
import {Query} from "./query"
import {QueryList} from "./query_list"
import {Entity} from "silver-ecs"
import {useWorld} from "../../hooks/use_world"
import {DebugHighlighted, DebugSelected} from "silver-lib"

type State =
  | {mode: "queries"}
  | {mode: "query"; query: QueryDef}
  | {mode: "entity"; query: QueryDef; entity: Entity}

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
        <Text onClick={() => setState({mode: "query", query: state.query})}>
          Back
        </Text>
      )
  }
}
