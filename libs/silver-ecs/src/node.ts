import * as Type from "./type"
import * as Entity from "./entity"
import * as SparseMap from "./sparse_map"
import * as SparseSet from "./sparse_set"
import * as Transaction from "./transaction"
import * as RelMap from "./rel_map"

type NodeIteratee = (node: T) => boolean | void

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
  entities
  id
  listeners
  next_nodes
  prev_nodes
  type
  rel_maps

  constructor(type: Type.T) {
    this.entities = SparseSet.make<Entity.T>()
    this.id = make_node_id()
    this.listeners = [] as Listener[]
    this.next_nodes = SparseMap.make<Node>()
    this.prev_nodes = SparseMap.make<Node>()
    this.type = type
    this.rel_maps = [] as RelMap.T<Entity.T>[]
    for (let i = 0; i < type.rels_inverse.length; i++) {
      let rel_inverse = type.rels_inverse[i]
      this.rel_maps[rel_inverse.id] = RelMap.make()
    }
  }
}

export type T = Node

export let make = (type: Type.T = Type.empty): T => {
  return new Node(type)
}

export let add_listener = (
  node: T,
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

export let emit_node_entities_changed = (node: T): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_entities_changed?.()
  }
}

export let emit_node_created = (node: T, created_node: T): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_created?.(created_node)
  }
}

export let emit_node_disposed = (node: T, disposed_node: T): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_disposed?.(disposed_node)
  }
}

export let emit_entities_in = (node: T, batch: Transaction.Batch): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_entities_in?.(batch)
  }
}

export let emit_entities_out = (node: T, batch: Transaction.Batch): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_node_entities_out?.(batch)
  }
}

export let insert_entity = (node: T, entity: Entity.T): void => {
  SparseSet.add(node.entities, entity)
  traverse_left(node, function insert_emit_node_entities_changed(visit) {
    emit_node_entities_changed(visit)
  })
}

export let remove_entity = (node: T, entity: Entity.T): void => {
  SparseSet.delete(node.entities, entity)
  traverse_left(node, function remove_emit_node_entities_changed(visit) {
    emit_node_entities_changed(visit)
  })
  for (let i = 0; i < node.type.rels.length; i++) {
    let rel_map = node.rel_maps[i]
    if (rel_map === undefined) {
      continue
    }
    rel_map.delete_object(entity)
  }
}

export let set_rel_object = (
  node: T,
  rel_id: number,
  subject: Entity.T,
  object: Entity.T,
) => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return
  }
  rel_map.set_object(subject, object)
}

export let delete_rel_object = (node: T, rel_id: number, object: Entity.T) => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return
  }
  rel_map.delete_object(object)
}

export let delete_rel_subject = (
  node: T,
  rel_id: number,
  subject: Entity.T,
) => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return
  }
  rel_map.delete_subject(subject)
}

export let has_rel_subject = (node: T, rel_id: number, subject: Entity.T) => {
  let rel_map = node.rel_maps[rel_id]
  if (rel_map === undefined) {
    return false
  }
  return rel_map.has_subject(subject)
}

export let traverse_right = (root: T, iteratee: NodeIteratee): void => {
  let nodes = [root]
  let nodes_visited = new Set<T>()
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

export let traverse_left = (root: T, iteratee: NodeIteratee): void => {
  let nodes = [root]
  let nodes_visited = new Set<T>()
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
  next_node: T,
  prev_node: T,
  xor = Type.xor_hash_u(next_node.type, prev_node.type),
): void => {
  SparseMap.set(next_node.prev_nodes, xor, prev_node)
  SparseMap.set(prev_node.next_nodes, xor, next_node)
}

export let unlink = (
  next_node: T,
  prev_node: T,
  xor = Type.xor_hash_u(next_node.type, prev_node.type),
): void => {
  SparseMap.delete(next_node.prev_nodes, xor)
  SparseMap.delete(prev_node.next_nodes, xor)
}
