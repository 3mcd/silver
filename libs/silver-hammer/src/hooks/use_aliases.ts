import {useContext} from "react"
import {aliasContext} from "../context/alias_context"

export let useAliases = () => {
  return useContext(aliasContext)
}
