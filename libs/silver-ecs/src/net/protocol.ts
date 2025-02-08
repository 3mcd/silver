import {assert, assert_exists} from "#assert"
import * as Buffer from "#buffer"
import * as Component from "#component"
import * as Entity from "#entity"
import * as Node from "#node"
import * as Schema from "#schema"
import * as SparseMap from "#sparse_map"
import * as World from "#world"
import * as InterestQueue from "./interest_queue"
import * as Serde from "./serde"

export enum MessageType {
  Identity = 0,
  Interest = 1,
  TimeSyncRequest = 2,
  TimeSyncResponse = 3,
}

export let read_message_type = (buffer: Buffer.T) => {
  return Buffer.read_u8(buffer)
}

export let init_identity = () => {
  let buffer = Buffer.make(5)
  Buffer.write_u8(buffer, MessageType.Identity)
  return buffer
}

export let write_identity = (buffer: Buffer.T, id: number) => {
  Buffer.write_u32(buffer, id)
}

export let read_identity = (buffer: Buffer.T) => {
  return Buffer.read_u32(buffer)
}

export let init_time_sync_request = () => {
  let buffer = Buffer.make(9)
  Buffer.write_u8(buffer, MessageType.TimeSyncRequest)
  return buffer
}

export let write_time_sync_request = (buffer: Buffer.T, t_mono: number) => {
  Buffer.write_f64(buffer, t_mono)
}

export let read_time_sync_request = (buffer: Buffer.T) => {
  return Buffer.read_f64(buffer)
}

export let init_time_sync_response = () => {
  let buffer = Buffer.make(17)
  Buffer.write_u8(buffer, MessageType.TimeSyncResponse)
  return buffer
}

export let write_time_sync_response = (
  buffer: Buffer.T,
  t_origin: number,
  t_remote: number,
) => {
  Buffer.write_f64(buffer, t_origin)
  Buffer.write_f64(buffer, t_remote)
}

export let read_time_sync_response = (
  buffer: Buffer.T,
  out: [number, number],
) => {
  out[0] = Buffer.read_f64(buffer)
  out[1] = Buffer.read_f64(buffer)
}

export let init_interest = () => {
  let buffer = Buffer.make(1, 1_024)
  Buffer.write_u8(buffer, MessageType.Interest)
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
  let segment_index = SparseMap.get(segment_indices, node_id)
  if (segment_index === undefined) {
    segment_index = segment_count++
    SparseMap.set(segment_indices, node_id, segment_index)
  }
  return segment_index
}

let write_segment_components = (
  buffer: Buffer.T,
  node_match: Component.T[],
) => {
  for (let i = 0; i < node_match.length; i++) {
    let component = node_match[i]
    if (Component.is_rel(component)) {
      // TODO: relations
    } else {
      assert(Component.is_ref(component))
      Buffer.write_u32(buffer, component.id)
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
    Buffer.write_u32(buffer, entity)
    for (let i = 0; i < node_match.length; i++) {
      let component = node_match[i]
      if (Component.is_rel(component)) {
        // TODO: relations
      } else {
        assert(Component.is_ref(component))
        let ref_value = world.get(entity, component)
        let ref_encoding = serde.encoding_from_ref_id(component.id)
        ref_encoding.encode(buffer, ref_value)
      }
    }
  }
}

let compute_message_length = (
  buffer: Buffer.T,
  interest: InterestQueue.T,
  world: World.T,
  serde: Serde.T,
) => {
  let offset = buffer.write_offset
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
    let index = SparseMap.get(segment_lengths, entity_node.id) ?? 0
    segment[index] = entity
    SparseMap.set(segment_lengths, entity_node.id, index + 1)
  }
  return offset - buffer.write_offset
}

export let encode_interest = (
  buffer: Buffer.T,
  interest: InterestQueue.T,
  world: World.T,
) => {
  let serde = world.get_resource(Serde.res)
  let length = compute_message_length(buffer, interest, world, serde)
  Buffer.grow(buffer, length)
  SparseMap.each(segment_indices, (node_id, segment_index) => {
    let segment = assert_exists(segments[segment_index])
    let segment_length = assert_exists(SparseMap.get(segment_lengths, node_id))
    let node = assert_exists(SparseMap.get(world.graph.nodes_by_id, node_id))
    let match = get_node_match(node, serde)
    Buffer.write_u32(buffer, node_id)
    Buffer.write_u32(buffer, segment.length)
    write_segment_components(buffer, match)
    write_segment_entities(buffer, match, segment, segment_length, world, serde)
  })
  segment_count = 0
  SparseMap.clear(segment_indices)
  SparseMap.clear(segment_lengths)
}
