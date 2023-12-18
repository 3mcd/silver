import {Commands, Type} from "silver-ecs"
import * as Model from "./model"
import {SPAWN_MESSAGE_TYPE} from "./protocol"

type TypeEncoder = (view: DataView, offset: number) => number

let typeEncoders: TypeEncoder[] = []

let compileTypeEncoder = (type: Type, model: Model.T): TypeEncoder => {
  let body = "return(v,o)=>{"
  for (let i = 0; i < type.components.length; i++) {
    let component = type.components[i]
    body += `v.setUint32(o,m[${component.id}]);`
    body += `o+=4;`
  }
  body += "}"
  return Function(body)(model.toIso)
}

export let encodeSpawn = (
  view: DataView,
  offset: number,
  model: Model.T,
  spawn: Commands.Spawn,
) => {
  view.setUint8(offset, SPAWN_MESSAGE_TYPE)
  offset += 1
  view.setUint8(offset, spawn.type.components.length)
  offset += 1
  let encodeType =
    typeEncoders[spawn.type.hash] ?? compileTypeEncoder(spawn.type, model)
  encodeType(view, offset)
}

export let decodeSpawn = (view: DataView, offset: number, model: Model.T) => {
  let type = model.iso[view.getUint8(offset)]
  offset += 1
  let typeComponentsLength = view.getUint8(offset)
  offset += 1
  for (let i = 0; i < typeComponentsLength; i++) {
    let component = view.getUint32(offset)
  }
}
