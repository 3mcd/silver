import * as ecs from "silver-ecs"
import * as three from "three"
import * as lib from "silver-lib"

export let IsThree = ecs.tag()
export let Scale = ecs.value<number>()
export let Object3D = ecs.type(IsThree, lib.Position, lib.Rotation, Scale)

export let ThreeGeometry = ecs.value<three.BufferGeometry>()
export let ThreeMaterial = ecs.value<three.Material>()
export let ThreeLight = ecs.value<three.Light>()
export let ThreePerspectiveCamera = ecs.value<three.PerspectiveCamera>()

export let Mesh = ecs.type(ThreeGeometry, ThreeMaterial, Object3D)
export let Light = ecs.type(ThreeLight, Object3D)
export let Camera = ecs.type(ThreePerspectiveCamera, Object3D)

export let InstanceCount = ecs.value<number>()
export let InstancedMesh = ecs.type(Mesh, InstanceCount)
export let IsInstance = ecs.tag()
export let InstanceOf = ecs.relation(ecs.Topology.Exclusive)
export let Instance = ecs.type(Object3D, IsInstance, InstanceOf)

export let CastsShadow = ecs.tag()
export let ReceivesShadow = ecs.tag()
