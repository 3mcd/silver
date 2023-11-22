import * as ecs from "silver-ecs"
import * as three from "three"

let threeObject = {
  type: "string",
  uuid: "string",
} satisfies ecs.Schema.Object

export let ThreeGeometry = ecs.value<three.BufferGeometry>(threeObject)
export let ThreeMaterial = ecs.value<three.Material>(threeObject)
export let ThreeLight = ecs.value<three.Light>(threeObject)
export let ThreeCamera = ecs.value<three.PerspectiveCamera>(threeObject)

export let Mesh = ecs.type(ThreeGeometry, ThreeMaterial)

export let InstanceCount = ecs.value<number>()
export let Instanced = ecs.type(Mesh, InstanceCount)
export let IsInstance = ecs.tag()
export let InstanceOf = ecs.relation(ecs.Topology.Exclusive)
export let Instance = ecs.type(IsInstance, InstanceOf)

export let CastsShadow = ecs.tag()
export let ReceivesShadow = ecs.tag()
