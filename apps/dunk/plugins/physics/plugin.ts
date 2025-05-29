import {App, Range, System} from "silver-ecs"
import {Timestep} from "silver-ecs/plugins"

export * from "./data"

export let update = Range.make(System.when(Timestep.logical))

export let plugin: App.Plugin = app => {}
