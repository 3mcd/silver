import * as Graph from "./graph"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as Type from "../data/type"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import {exists} from "../assert"

export type Iteratee = (
  batch: SparseSet.T<Entity.T>,
  prev_node?: Graph.Node,
  next_node?: Graph.Node,
) => void

const make_batch_key = (prev_node_id: number, next_node_id: number) =>
  (BigInt(next_node_id) << 31n) | BigInt(prev_node_id)

const decompose_batch_key_next = (key: bigint) =>
  Number((key & 0xffffffff00000000n) >> 31n)

const decompose_batch_key_prev = (key: bigint) => Number(key & 0xffffffffn)

export class Event {
  phase
  entities
  node

  constructor(phase: string, entities: Entity.T[], node: Graph.Node) {
    this.phase = phase
    this.entities = entities
    this.node = node
  }
}

const make_move_event = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  node: Graph.Node,
): Event => {
  return new Event(phase, SparseSet.values(entities), node)
}

const emit_spawned_entities = (
  phase: string,
  batch: SparseSet.T<Entity.T>,
  next_node: Graph.Node,
) => {
  const event = make_move_event(phase, batch, next_node)
  Graph.traverse_prev(
    next_node,
    function emit_spawned_entities(node: Graph.Node) {
      Signal.emit(node.$included, event)
    },
  )
}

const emit_included_entities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prev_node: Graph.Node,
  next_node: Graph.Node,
) => {
  const event = make_move_event(phase, entities, next_node)
  Graph.traverse_prev(
    next_node,
    function emit_included_entities(node: Graph.Node) {
      if (node !== prev_node && !Type.is_superset(prev_node.type, node.type)) {
        Signal.emit(node.$included, event)
      }
    },
  )
}

const emit_excluded_entities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prev_node: Graph.Node,
  next_node: Graph.Node,
) => {
  const event = make_move_event(phase, entities, prev_node)
  Graph.traverse_prev(
    prev_node,
    function emit_excluded_entities(node: Graph.Node) {
      if (node !== next_node && !Type.is_superset(node.type, next_node.type)) {
        Signal.emit(node.$excluded, event)
      }
    },
  )
}

const emit_despawned_entities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prev_node: Graph.Node,
) => {
  const event = make_move_event(phase, entities, prev_node)
  Graph.traverse_prev(
    prev_node,
    function emit_despawned_entities(node: Graph.Node) {
      Signal.emit(node.$excluded, event)
    },
  )
}

const emit_moved_entities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prev_node: Graph.Node,
  next_node: Graph.Node,
) => {
  const included = make_move_event(phase, entities, next_node)
  const excluded = make_move_event(phase, entities, prev_node)
  Graph.traverse_prev(
    next_node,
    function emit_included_entities(node: Graph.Node) {
      Signal.emit(node.$included, included)
    },
  )
  Graph.traverse_prev(
    prev_node,
    function emit_excluded_entities(node: Graph.Node) {
      Signal.emit(node.$excluded, excluded)
    },
  )
}

class Transition {
  entity_index
  entity_batches

  constructor() {
    this.entity_index = SparseMap.make<bigint>()
    this.entity_batches = new Map<bigint, SparseSet.T<Entity.T>>()
  }
}
export type T = Transition

export const drain = (
  transition: T,
  graph: Graph.T,
  phase: string,
  iteratee?: Iteratee,
) => {
  if (transition.entity_batches.size === 0) {
    return
  }
  const emit_entities = (
    entities: SparseSet.T<Entity.T>,
    batch_key: bigint,
  ) => {
    const prev_node_id = decompose_batch_key_prev(batch_key)
    const next_node_id = decompose_batch_key_next(batch_key)
    const prev_node = Graph.find_by_id(graph, prev_node_id)
    const next_node = Graph.find_by_id(graph, next_node_id)
    iteratee?.(entities, prev_node, next_node)
    if (prev_node && prev_node !== graph.root) {
      if (next_node_id === graph.root.id) {
        emit_despawned_entities(phase, entities, prev_node)
      } else {
        const next_node = exists(Graph.find_by_id(graph, next_node_id))
        if (Type.is_superset(next_node.type, prev_node.type)) {
          emit_included_entities(phase, entities, prev_node, next_node)
        } else if (Type.is_superset(prev_node.type, next_node.type)) {
          emit_excluded_entities(phase, entities, prev_node, next_node)
        } else {
          emit_moved_entities(phase, entities, prev_node, next_node)
        }
      }
    } else {
      emit_spawned_entities(phase, entities, exists(next_node))
    }
  }
  transition.entity_batches.forEach(emit_entities)
  transition.entity_batches.clear()
  SparseMap.clear(transition.entity_index)
}

export const locate = (transition: T, entity: Entity.T): number | undefined => {
  const curr_batch_key = SparseMap.get(transition.entity_index, entity)
  if (curr_batch_key === undefined) {
    return
  }
  return decompose_batch_key_next(curr_batch_key)
}

export const move = (
  transition: T,
  entity: Entity.T,
  prev_node: Graph.Node,
  next_node: Graph.Node,
) => {
  const prev_batch_key = SparseMap.get(transition.entity_index, entity) ?? 0n
  const prev_batch = transition.entity_batches.get(prev_batch_key)
  if (prev_batch !== undefined) {
    SparseSet.delete(prev_batch, entity)
  }
  const next_batch_key = make_batch_key(prev_node.id, next_node.id)
  let next_batch = transition.entity_batches.get(next_batch_key)
  if (next_batch === undefined) {
    next_batch = SparseSet.make()
    transition.entity_batches.set(next_batch_key, next_batch)
  }
  SparseSet.add(next_batch, entity)
  SparseMap.set(transition.entity_index, entity, next_batch_key)
}

export const make = (): T => new Transition()
