import * as S from "silver-ecs"
import * as three from "three"

let threeObject = {
  type: "string",
  uuid: "string",
} satisfies S.Schema.Object

export let ThreeGeometry = S.ref<three.BufferGeometry>(threeObject)
export let ThreeMaterial = S.ref<three.Material>(threeObject)
export let ThreeLight = S.ref<three.Light>(threeObject)
export let ThreeCamera = S.ref<three.PerspectiveCamera>(threeObject)

export let Mesh = S.type(ThreeGeometry, ThreeMaterial)

export let InstanceCount = S.ref<number>("u32")
export let Instanced = S.type(Mesh, InstanceCount)
export let IsInstance = S.tag()
export let InstanceOf = S.relation(S.Topology.Exclusive)
export let Instance = S.type(IsInstance, InstanceOf)

export let CastsShadow = S.tag()
export let ReceivesShadow = S.tag()
