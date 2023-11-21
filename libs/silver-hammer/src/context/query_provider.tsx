import {useMemo} from "react"
import {Queries, queryContext} from "./query_context"
import {Query} from "silver-ecs"

type Props = React.PropsWithChildren<{
  queries?: {
    [key: string]: Query
  }
}>

export let QueryProvider = (props: Props) => {
  let queries = useMemo(
    () =>
      Object.entries(props.queries ?? {}).reduce((a, [name, query]) => {
        a.push({name, query})
        return a
      }, [] as Queries),
    [props.queries],
  )
  return (
    <queryContext.Provider value={queries}>
      {props.children}
    </queryContext.Provider>
  )
}
