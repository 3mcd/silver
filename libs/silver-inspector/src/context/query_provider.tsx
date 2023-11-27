import {useMemo} from "react"
import {QueryDefs, queryContext} from "./query_context"
import * as S from "silver-ecs"

type Props = React.PropsWithChildren<{
  queries?: {
    [key: string]: S.Query
  }
}>

export let QueryProvider = (props: Props) => {
  let queries = useMemo(
    () =>
      Object.entries(props.queries ?? {}).reduce((a, [name, query]) => {
        a.push({name, query})
        return a
      }, [] as QueryDefs),
    [props.queries],
  )
  return (
    <queryContext.Provider value={queries}>
      {props.children}
    </queryContext.Provider>
  )
}
