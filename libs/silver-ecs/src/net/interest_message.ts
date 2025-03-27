import {assert, assert_exists} from "#assert"
import * as Buffer from "#buffer"
import * as Component from "#component"
import * as Entity from "#entity"
import * as Node from "#node"
import * as Schema from "#schema"
import * as SparseMap from "#sparse_map"
import * as Type from "#type"
import * as World from "#world"
import * as InterestQueue from "./interest_queue"
import {MessageType} from "./message_type"
import * as Serde from "./serde"

export let init_interest = () => {
  let buffer = Buffer.make(1, 1_024)
  buffer.write_u8(MessageType.Interest)
  return buffer
}

let node_bytes_per_element = [] as number[]
let node_match_cache = new WeakMap<Node.T, Component.T[]>()

let segments: Entity.T[][] = []
let segment_count = 0
let segment_indices = SparseMap.make<number>()
let segment_lengths = SparseMap.make<number>()

let get_node_match = (node: Node.T, serde: Serde.T) => {
  let match = node_match_cache.get(node)
  if (match === undefined) {
    match = node.type.vec.filter(component => serde.has(component))
    node_match_cache.set(node, match)
  }
  return match
}

let bytes_per_entity = (node: Node.T, serde: Serde.T) => {
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
  buffer: Buffer.T,
  node_match: Component.T[],
  serde: Serde.T,
) => {
  buffer.write_u8(node_match.length)
  for (let i = 0; i < node_match.length; i++) {
    let component = node_match[i]
    if (Component.is_rel(component)) {
      // TODO: relations
    } else {
      assert(Component.is_ref(component))
      buffer.write_u32(serde.to_iso(component))
    }
  }
}

let write_segment_entities = (
  buffer: Buffer.T,
  node_match: Component.T[],
  segment: Entity.T[],
  segment_length: number,
  world: World.T,
  serde: Serde.T,
) => {
  for (let i = 0; i < segment_length; i++) {
    let entity = segment[i]
    buffer.write_u32(entity)
    for (let i = 0; i < node_match.length; i++) {
      let component = node_match[i]
      if (Component.is_rel(component)) {
        // TODO: relations
      } else {
        assert(Component.is_ref(component))
        let ref_out = world.get(entity, component)
        let ref_encoding = serde.encoding_from_ref_id(component.id)
        ref_encoding.encode(buffer, ref_out)
      }
    }
  }
}

/**
 * Compute the byte length of an interest message, writing the node (segment)
 * indices and lengths to `segment_indices` and `segment_lengths`, respectively.
 */
let load_segments = (
  buffer: Buffer.T,
  interest: InterestQueue.T,
  world: World.T,
  serde: Serde.T,
) => {
  let offset = buffer.write_offset
  offset += 1 // segment count
  while (offset < buffer.buffer.maxByteLength) {
    let entity = interest.pop()
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
  buffer: Buffer.T,
  interest: InterestQueue.T,
  world: World.T,
) => {
  let serde = world.get_resource(Serde.res)
  let message_length = load_segments(buffer, interest, world, serde)
  buffer.grow(message_length)
  buffer.write_u8(segment_count)
  segment_indices.for_each((node_id, segment_index) => {
    let segment = assert_exists(segments[segment_index])
    let segment_length = assert_exists(segment_lengths.get(node_id))
    let node = assert_exists(world.graph.nodes_by_id.get(node_id))
    let node_match = get_node_match(node, serde)
    buffer.write_u32(segment_length)
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
  segment_count = 0
  segment_indices.clear()
  segment_lengths.clear()
}

let segment_match = [] as Component.T[]
let ref_out = [] as unknown[]

export let decode_interest = (
  buffer: Buffer.T,
  world: World.T,
  init = false,
) => {
  let serde = world.get_resource(Serde.res)
  let segment_count = buffer.read_u8()
  for (let i = 0; i < segment_count; i++) {
    let segment_length = buffer.read_u32()
    let segment_match_length = buffer.read_u8()
    for (let j = 0; j < segment_match_length; j++) {
      let component_id_iso = buffer.read_u32()
      let component = serde.from_iso(component_id_iso)
      segment_match[j] = component
    }
    let type: Type.T
    for (let j = 0; j < segment_length; j++) {
      let entity = buffer.read_u32() as Entity.T
      if (world.is_alive(entity)) {
        for (let k = 0; k < segment_match_length; k++) {
          let component = segment_match[k]
          if (world.has(entity, component)) {
            if (Component.is_ref(component)) {
              let ref_encoding = serde.encoding_from_ref_id(component.id)
              let ref_store = world.store(component.id)
              ref_encoding.decode(buffer, entity, ref_store, true)
            }
          } else {
            if (Component.is_ref(component)) {
              let ref_encoding = serde.encoding_from_ref_id(component.id)
              ref_encoding.decode(buffer, entity, ref_out, true)
              world.add(entity, component, ref_out[entity])
            } else {
              world.add(entity, component as Component.Tag & Component.Pair)
            }
          }
        }
      } else {
        type ??= Type.make(segment_match.slice(0, segment_match_length))
        let values = [] as unknown[]
        for (let k = 0; k < segment_match_length; k++) {
          let component = segment_match[k]
          if (Component.is_rel(component)) {
          } else {
            let ref_encoding = serde.encoding_from_ref_id(component.id)
            ref_encoding.decode(buffer, entity, ref_out, init)
            if (init) {
              values.push(ref_out[entity])
            }
          }
        }
        if (init) {
          world.reserve(entity, type, values)
        }
      }
    }
  }
}
