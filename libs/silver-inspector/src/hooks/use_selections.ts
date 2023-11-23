import {useCallback, useContext} from "react"
import {selectedContext} from "../context/selected_context"
import {useWorld} from "./use_world"
import {DebugSelected} from "silver-lib"

export let useSelections = () => {
  let world = useWorld()
  let selected = useContext(selectedContext)
  let clear = useCallback(() => {
    for (let i = 0; i < selected.length; i++) {
      let entity = selected[i]
      world.remove(entity, DebugSelected)
    }
  }, [selected])
  let despawn = useCallback(() => {
    for (let i = 0; i < selected.length; i++) {
      let entity = selected[i]
      world.despawn(entity)
    }
  }, [selected])
  return {selected, clear, despawn}
}
