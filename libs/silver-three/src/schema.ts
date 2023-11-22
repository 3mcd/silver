import * as ecs from "silver-ecs"
import * as three from "three"

export let ThreeGeometry = ecs.value<three.BufferGeometry>({
  type: "string",
  uuid: "string",
})
export let ThreeMaterial = ecs.value<three.Material>({
  type: "string",
  uuid: "string",
})
export let ThreeLight = ecs.value<three.Light>()
export let ThreePerspectiveCamera = ecs.value<three.PerspectiveCamera>()

export let Mesh = ecs.type(ThreeGeometry, ThreeMaterial)
export let Light = ecs.type(ThreeLight)
export let Camera = ecs.type(ThreePerspectiveCamera)

export let InstanceCount = ecs.value<number>()
export let Instanced = ecs.type(Mesh, InstanceCount)
export let IsInstance = ecs.tag()
export let InstanceOf = ecs.relation(ecs.Topology.Exclusive)
export let Instance = ecs.type(IsInstance, InstanceOf)

export let CastsShadow = ecs.tag()
export let ReceivesShadow = ecs.tag()
