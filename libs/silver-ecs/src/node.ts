import * as Assert from "./assert"
import * as Type from "./type"
import * as Entity from "./entity"
import * as SparseMap from "./sparse_map"
import * as SparseSet from "./sparse_set"
import * as Transaction from "./transaction"
import * as RelMap from "./rel_map"

type NodeIteratee = (node: Node) => boolean | void

let next_node_id = 1
let make_node_id = () => next_node_id++

export interface Listener {
  on_node_entities_changed?(): void
  on_node_created?(node: T): void
  on_node_disposed?(node: T): void
  on_node_entities_in?(batch: Transaction.Batch): void
  on_node_entities_out?(batch: Transaction.Batch): void
}

export class Node {
  disposed
  entities
  id
  listeners
  next_nodes
  prev_nodes
  type
  rel_maps

  constructor(type: Type.T = Type.make()) {
    this.disposed = false
    this.entities = SparseSet.make<Entity.T>()
    this.id = make_node_id()
    this.listeners = [] as Listener[]
    this.next_nodes = SparseMap.make<Node>()
    this.prev_nodes = SparseMap.make<Node>()
    this.type = type
    this.rel_maps = [] as RelMap.T[]
    for (let i = 0; i < type.rel_targets.length; i++) {
      let rel_target = type.rel_targets[i]
      this.rel_maps[rel_target.id] = RelMap.make()
    }
  }
}

export type T = Node

export let make = (type: Type.T = Type.make()): T => {
  return new Node(type)
}

export let add_listener = (
  node: Node,
  listener: Listener,
  emit_existing_nodes_as_created = false,
): void => {
  node.listeners.push(listener)
  if (
    emit_existing_nodes_as_created &&
    listener.on_node_created !== undefined
  ) {
    traverse_right(node, function add_emit_node_created(visit) {
      listener.on_node_created?.(visit)
    })
  }
}

export let emit_node_entities_changed = (node: Node): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_entities_changed?.()
  }
}

export let emit_node_created = (node: Node, created_node: Node): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_created?.(created_node)
  }
}

export let emit_node_disposed = (node: Node, disposed_node: Node): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_disposed?.(disposed_node)
  }
}

export let emit_entities_in = (node: Node, batch: Transaction.Batch): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_entities_in?.(batch)
  }
}

export let emit_entities_out = (node: Node, batch: Transaction.Batch): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_entities_out?.(batch)
  }
}

export let insert_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.add(node.entities, entity)
  traverse_left(node, function insert_emit_node_entities_changed(visit) {
    emit_node_entities_changed(visit)
  })
}

export let remove_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.delete(node.entities, entity)
  traverse_left(node, function remove_emit_node_entities_changed(visit) {
    emit_node_entities_changed(visit)
  })
  for (let i = 0; i < node.type.rels.length; i++) {
    let rel_map = node.rel_maps[i]
    if (rel_map === undefined) {
      continue
    }
    rel_map.delete_target(entity)
  }
}

export let set_rel_target = (
  node: Node,
  rel_id: number,
  source: Entity.T,
  target: Entity.T,
): void => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return
  }
  rel_map.set(source, target)
}

export let unset_rel_source = (
  node: Node,
  rel_id: number,
  source: Entity.T,
): void => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return
  }
  rel_map.delete_source(source)
}

export let unset_rel_target = (
  node: Node,
  rel_id: number,
  target: Entity.T,
): void => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return
  }
  rel_map.delete_target(target)
}

export let has_rel_source = (
  node: Node,
  rel_id: number,
  source: Entity.T,
): boolean => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return false
  }
  return rel_map.has(source)
}

export let traverse_right = (root: Node, iteratee: NodeIteratee): void => {
  let nodes = [root]
  let nodes_visited = new Set<Node>()
  let i = 1
  while (i > 0) {
    let node = nodes[--i]
    if (nodes_visited.has(node) || iteratee(node) === false) {
      continue
    }
    nodes_visited.add(node)
    SparseMap.each_value(
      node.next_nodes,
      function traverse_next_inner(next_node) {
        nodes[i++] = next_node
      },
    )
  }
}

export let traverse_left = (root: Node, iteratee: NodeIteratee): void => {
  let nodes = [root]
  let nodes_visited = new Set<Node>()
  let i = 1
  while (i > 0) {
    let node = nodes[--i]
    if (nodes_visited.has(node) || iteratee(node) === false) {
      continue
    }
    nodes_visited.add(node)
    SparseMap.each_value(
      node.prev_nodes,
      function traverse_prev_inner(prev_node) {
        nodes[i++] = prev_node
      },
    )
  }
}

export let link = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor_hash_u(next_node.type, prev_node.type),
): void => {
  SparseMap.set(next_node.prev_nodes, xor, prev_node)
  SparseMap.set(prev_node.next_nodes, xor, next_node)
}

export let unlink = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor_hash_u(next_node.type, prev_node.type),
): void => {
  SparseMap.delete(next_node.prev_nodes, xor)
  SparseMap.delete(prev_node.next_nodes, xor)
}
