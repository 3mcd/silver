import {createContext} from "react"
import * as S from "silver-ecs"

export let selectedContext = createContext<S.Entity[]>([])
