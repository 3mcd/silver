import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Transaction from "./transaction"

type NodeIteratee = (node: Node) => boolean | void

let next_node_id = 1
let make_node_id = () => next_node_id++

export interface Listener {
  on_node_entities_changed?(): void
  on_node_created?(node: T): void
  on_node_disposed?(node: T): void
  on_entities_in?(batch: Transaction.Batch): void
  on_entities_out?(batch: Transaction.Batch): void
}

export class Node {
  disposed
  edges_next
  edges_prev
  entities
  id
  listeners
  type

  constructor(type: Type.T = Type.make()) {
    this.disposed = false
    this.edges_next = SparseMap.make<Node>()
    this.edges_prev = SparseMap.make<Node>()
    this.entities = SparseSet.make<Entity.T>()
    this.id = make_node_id()
    this.listeners = [] as Listener[]
    this.type = type
  }
}

export type T = Node

export let make = (type: Type.T = Type.make()): T => {
  return new Node(type)
}

export let add_listener = (
  node: Node,
  listener: Listener,
  emit_existing_tables_as_created = false,
): void => {
  node.listeners.push(listener)
  if (
    emit_existing_tables_as_created &&
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
    node.listeners[i].on_entities_in?.(batch)
  }
}

export let emit_entities_out = (node: Node, batch: Transaction.Batch): void => {
  for (let i = 0; i < node.listeners.length; i++) {
    node.listeners[i].on_entities_out?.(batch)
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
      node.edges_next,
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
      node.edges_prev,
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
  SparseMap.set(next_node.edges_prev, xor, prev_node)
  SparseMap.set(prev_node.edges_next, xor, next_node)
}

export let unlink = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor_hash_u(next_node.type, prev_node.type),
): void => {
  SparseMap.delete(next_node.edges_prev, xor)
  SparseMap.delete(prev_node.edges_next, xor)
}
