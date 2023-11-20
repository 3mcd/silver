import {useContext} from "react"
import {aliasContext} from "../alias_context"

export let useAliases = () => {
  return useContext(aliasContext)
}
