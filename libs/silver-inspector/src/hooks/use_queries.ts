import {useContext} from "react"
import {queryContext} from "../context/query_context"

export let useQueries = () => {
  return useContext(queryContext)
}
