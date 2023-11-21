import {useState} from "react"
import {Stack} from "../../../styled-system/jsx"
import {Text} from "../../components/text"
import {useQueries} from "../../hooks/use_queries"
import {Query} from "./query"

type State =
  | {mode: "queries"}
  | {mode: "query"; i: number}
  | {mode: "entity"; i: number}

export let Queries = () => {
  const [state, setState] = useState<State>({mode: "queries"})
  let queries = useQueries()
  switch (state.mode) {
    case "queries":
      return (
        <Stack height="100%">
          {queries.map(({name}, i) => (
            <Text key={name} onClick={() => setState({mode: "query", i})}>
              {name}
            </Text>
          ))}
        </Stack>
      )
    case "query":
      return (
        <Query
          query={queries[state.i].query}
          onBack={() => setState({mode: "queries"})}
          onEntitySelected={() => setState({mode: "entity", i: state.i})}
        />
      )
    case "entity":
      return (
        <Text onClick={() => setState({mode: "query", i: state.i})}>Back</Text>
      )
  }
}
