import {WorldProviderProps, worldContext} from "./world_context"

export let WorldProvider = (props: WorldProviderProps) => {
  return (
    <worldContext.Provider value={props.world}>
      {props.children}
    </worldContext.Provider>
  )
}
