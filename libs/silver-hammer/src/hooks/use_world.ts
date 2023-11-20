import {useContext} from "react"
import {worldContext} from "../world_context"

export let useWorld = () => {
  return useContext(worldContext)
}
