import {useContext} from "react"
import {worldContext} from "../context/world_context"

export let useWorld = () => {
  return useContext(worldContext)
}
