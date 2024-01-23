import {Commands, Hash, Type, typeFrom} from "silver-ecs"
import {Assert} from "silver-lib"
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
  return Function("m", body)(model.toIso)
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
  offset += 1
  let count = view.getUint8(offset)
  offset += 1
  let hash = Hash.make()
  for (let i = 0; i < count; i++) {
    let cid = view.getUint32(offset + i * 4)
    hash = Hash.word(hash, cid)
  }
  let type = model.isoType[Hash.asUint(hash)]
  if (type === undefined) {
    let iso = [] as number[]
    for (let i = 0; i < count; i++) {
      iso.push(view.getUint32(offset))
      offset += 4
    }
    let components = iso.map(cid => Assert.exists(model.iso[cid]))
    type = typeFrom(components)
  } else {
    offset += count * 4
  }
  return type
}
