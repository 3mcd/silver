import {PropsWithChildren, createContext} from "react"
import {World} from "silver-ecs"

export let worldContext = createContext<World>(null!)

export type WorldProviderProps = PropsWithChildren<{
  world: World
}>
