import {Commands, Component, Hash, Type, type_from_components} from "silver-ecs"
import {Assert} from "silver-lib"
import * as Model from "./model"
import {SPAWN_MESSAGE_TYPE} from "./protocol"

type TypeEncoder = (view: DataView, offset: number) => number

let type_encoders: TypeEncoder[] = []

let make_type_encoder = (type: Type, model: Model.T): TypeEncoder => {
  let body = "return(v,o)=>{"
  for (let i = 0; i < type.components.length; i++) {
    let component = type.components[i]
    body += `v.setUint32(o,m[${component.id}]);`
    body += `o+=4;`
  }
  body += "}"
  return Function("m", body)(model.to_iso_component)
}

export let encode_spawn = (
  view: DataView,
  offset: number,
  model: Model.T,
  spawn: Commands.Spawn,
) => {
  view.setUint8(offset, SPAWN_MESSAGE_TYPE)
  offset += 1
  view.setUint8(offset, spawn.type.components.length)
  offset += 1
  let encode_type =
    type_encoders[spawn.type.hash] ?? make_type_encoder(spawn.type, model)
  encode_type(view, offset)
}

export let decode_spawn = (view: DataView, offset: number, model: Model.T) => {
  offset += 1
  let type_length = view.getUint8(offset)
  offset += 1
  let type_hash = Hash.make_hash()
  for (let i = 0; i < type_length; i++) {
    let component_id = view.getUint32(offset + i * 4)
    type_hash = Hash.hash_word(type_hash, component_id)
  }
  let type_hash_u = Hash.as_uint(type_hash)
  let type = model.iso_types[type_hash_u]
  if (type === undefined) {
    let components: Component[] = []
    for (let i = 0; i < type_length; i++) {
      let component_id = view.getUint32(offset)
      let component = Assert.value(model.iso_components[component_id])
      components.push(component)
      offset += 4
    }
    model.iso_types[type_hash_u] = type = type_from_components(components)
  } else {
    offset += type_length * 4
  }
  return type
}
