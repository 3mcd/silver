import {PropsWithChildren, createContext} from "react"
import * as S from "silver-ecs"

export let worldContext = createContext<S.World>(null!)

export type WorldProviderProps = PropsWithChildren<{
  world: S.World
}>
