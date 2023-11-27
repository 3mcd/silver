import {PropsWithChildren, useMemo} from "react"
import * as S from "silver-ecs"
import {DebugSelected} from "silver-lib"
import {useQuery} from "../hooks/use_queries"
import {useWorld} from "../hooks/use_world"
import {selectedContext} from "./selected_context"

type Props = PropsWithChildren

export let SelectedProvider = (props: Props) => {
  let world = useWorld()
  let query = useMemo(() => S.query(world, DebugSelected), [world])
  let queryResults = useQuery(query)
  return (
    <selectedContext.Provider value={queryResults}>
      {props.children}
    </selectedContext.Provider>
  )
}
