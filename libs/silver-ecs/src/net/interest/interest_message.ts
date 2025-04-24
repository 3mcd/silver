import {assert_exists} from "#assert"
import * as Buffer from "#buffer"
import * as Component from "#component"
import * as Entity from "#entity"
import * as Node from "#node"
import {Timestep} from "#plugins/index"
import * as Schema from "#schema"
import * as SparseMap from "#sparse_map"
import * as Type from "#type"
import * as World from "#world"
import {MessageType} from "../message_type.ts"
import * as Serde from "../serde.ts"
import * as Interest from "./interest.ts"

export let init_interest = () => {
  let buffer = Buffer.make(1, 1_024)
  buffer.write_u8(MessageType.Interest)
  return buffer
}

let discard_count = 0

let node_bytes_per_element = [] as number[]
let node_match_cache = new WeakMap<Node.t, Component.t[]>()

let segments: Entity.t[][] = []
let segment_count = 0
let segment_indices = SparseMap.make<number>()
let segment_lengths = SparseMap.make<number>()

let get_node_match = (node: Node.t, serde: Serde.t) => {
  let match = node_match_cache.get(node)
  if (match === undefined) {
    match = node.type.vec.filter(component => serde.has(component))
    node_match_cache.set(node, match)
  }
  return match
}

let bytes_per_entity = (node: Node.t, serde: Serde.t) => {
  let length = node_bytes_per_element[node.id]
  if (length !== undefined) {
    return length
  }
  length = 0
  for (let i = 0; i < node.type.refs.length; i++) {
    let ref = node.type.refs[i]
    if (ref.schema === undefined || !serde.has(ref)) {
      continue
    }
    length += Schema.bytes_per_element(ref.schema)
  }
  node_bytes_per_element[node.id] = length
  return length
}

let get_segment_index = (node_id: number) => {
  let segment_index = segment_indices.get(node_id)
  if (segment_index === undefined) {
    segment_index = segment_count++
    segment_indices.set(node_id, segment_index)
  }
  return segment_index
}

let write_segment_components = (
  buffer: Buffer.t,
  node_match: Component.t[],
  serde: Serde.t,
) => {
  buffer.write_u8(node_match.length)
  for (let i = 0; i < node_match.length; i++) {
    let component = node_match[i]
    if (Component.is_rel(component)) {
      // TODO: relations
    } else {
      buffer.write_u32(serde.to_iso(component))
    }
  }
}

let write_segment_entities = (
  buffer: Buffer.t,
  node_match: Component.t[],
  segment: Entity.t[],
  segment_length: number,
  world: World.t,
  serde: Serde.t,
) => {
  for (let i = 0; i < segment_length; i++) {
    let entity = segment[i]
    buffer.write_u32(entity)
    for (let i = 0; i < node_match.length; i++) {
      let component = node_match[i]
      if (Component.is_rel(component)) {
        // TODO: relations
      } else if (Component.is_ref(component)) {
        let ref_value = world.get(entity, component)
        let ref_encoding = serde.encoding_from_ref_id(component.id)
        ref_encoding.encode(buffer, ref_value)
      }
    }
  }
}

/**
 * Compute the byte length of an interest message, writing the node (segment)
 * indices and lengths to `segment_indices` and `segment_lengths`, respectively.
 */
let prepare_segments = (
  buffer: Buffer.t,
  interest: Interest.t,
  world: World.t,
  serde: Serde.t,
) => {
  let offset = buffer.write_offset
  offset += 4 // step
  offset += 1 // discard count

  discard_count = Math.min(
    interest.discarded_count(),
    (buffer.buffer.maxByteLength - offset) / 4,
  )
  offset += discard_count * 4

  offset += 1 // segment count
  while (offset < buffer.buffer.maxByteLength) {
    let entity = interest.take()
    if (entity === undefined) {
      break
    }
    let entity_node = world.get_entity_node(entity)
    let entity_size = bytes_per_entity(entity_node, serde)
    // entity id
    offset += entity_size + 4
    let segment_index = get_segment_index(entity_node.id)
    let segment = segments[segment_index]
    if (segment === undefined) {
      let node_match = get_node_match(entity_node, serde)
      // node id + segment length + node match
      offset += 8 + 4 * node_match.length
      segments[segment_index] = segment = []
    }
    let index = segment_lengths.get(entity_node.id) ?? 0
    segment[index] = entity
    segment_lengths.set(entity_node.id, index + 1)
  }
  return offset - buffer.write_offset
}

export let encode_interest = (
  buffer: Buffer.t,
  interest: Interest.t,
  world: World.t,
) => {
  let timestep = world.get_resource(Timestep.res)
  let serde = world.get_resource(Serde.res)
  let message_length = prepare_segments(buffer, interest, world, serde)
  buffer.grow(message_length)
  buffer.write_u32(timestep.step())
  buffer.write_u8(discard_count)
  for (let i = 0; i < discard_count; i++) {
    let entity = assert_exists(interest.take_discarded())
    buffer.write_u32(entity)
  }
  buffer.write_u8(segment_count)
  segment_indices.for_each((node_id, segment_index) => {
    let segment = assert_exists(segments[segment_index])
    let segment_length = assert_exists(segment_lengths.get(node_id))
    let node = assert_exists(world.graph.nodes_by_id.get(node_id))
    let node_match = get_node_match(node, serde)
    buffer.write_u8(segment_length)
    write_segment_components(buffer, node_match, serde)
    write_segment_entities(
      buffer,
      node_match,
      segment,
      segment_length,
      world,
      serde,
    )
  })
  discard_count = 0
  segment_count = 0
  segment_indices.clear()
  segment_lengths.clear()
}

let decode_ref_value_out = [] as unknown[]
let decode_ref_value = (
  buffer: Buffer.t,
  component: Component.t,
  serde: Serde.t,
  entity: Entity.t,
  out: unknown[],
) => {
  let ref_encoding = serde.encoding_from_ref_id(component.id)
  ref_encoding.decode(buffer, entity, out, true)
  let ref_value = out[entity]
  return ref_value
}

let segment_match = [] as Component.t[]

export let decode_interest = (buffer: Buffer.t, world: World.t) => {
  let serde = world.get_resource(Serde.res)
  let discard_count = buffer.read_u8()
  for (let i = 0; i < discard_count; i++) {
    let entity = buffer.read_u32() as Entity.t
    if (world.is_alive(entity)) {
      world.despawn(entity)
    }
  }
  let segment_count = buffer.read_u8()
  for (let i = 0; i < segment_count; i++) {
    let segment_length = buffer.read_u8()
    let segment_match_length = buffer.read_u8()
    for (let j = 0; j < segment_match_length; j++) {
      let component_id_iso = buffer.read_u32()
      let component = serde.from_iso(component_id_iso)
      segment_match[j] = component
    }
    let segment_match_type: Type.t | undefined
    for (let j = 0; j < segment_length; j++) {
      let entity = buffer.read_u32() as Entity.t
      if (world.is_alive(entity)) {
        for (let k = 0; k < segment_match_length; k++) {
          let component = segment_match[k]
          if (world.has(entity, component)) {
            if (Component.is_ref(component)) {
              let array = world.array(component.id)
              decode_ref_value(buffer, component, serde, entity, array)
            }
          } else {
            if (Component.is_ref(component)) {
              let value = decode_ref_value(
                buffer,
                component,
                serde,
                entity,
                decode_ref_value_out,
              )
              decode_ref_value_out[entity] = undefined
              world.add(entity, component, value)
            } else {
              world.add(entity, component as Component.Tag)
            }
          }
        }
      } else {
        let values: unknown[] = []
        for (let k = 0; k < segment_match_length; k++) {
          let component = segment_match[k]
          if (Component.is_ref(component)) {
            let value = decode_ref_value(
              buffer,
              component,
              serde,
              entity,
              decode_ref_value_out,
            )
            values[component.id] = value
            decode_ref_value_out[entity] = undefined
          }
        }
        if (segment_match_type === undefined) {
          let segment_match_vec = segment_match.slice(0, segment_match_length)
          segment_match_type = Type.make(segment_match_vec)
        }
        world.reserve(entity, segment_match_type, values)
      }
    }
  }
}
