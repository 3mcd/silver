import * as Type from "./type"
import * as Entity from "./entity"
import * as SparseMap from "./sparse_map"
import * as SparseSet from "./sparse_set"
import * as Transaction from "./stage"
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

  add_listener(
    listener: Listener,
    emit_existing_nodes_as_created = false,
  ): void {
    this.listeners.push(listener)
    if (
      emit_existing_nodes_as_created &&
      listener.on_node_created !== undefined
    ) {
      this.traverse_right(function add_emit_node_created(right_node) {
        listener.on_node_created?.(right_node)
      })
    }
  }

  emit_entities_in(batch: Transaction.Batch): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i].on_node_entities_in?.(batch)
    }
  }

  emit_entities_out(batch: Transaction.Batch): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i].on_node_entities_out?.(batch)
    }
  }

  insert_entity(entity: Entity.T): void {
    this.entities.add(entity)
    this.traverse_left(function insert_emit_node_entities_changed(left_node) {
      left_node.emit_node_entities_changed()
    })
  }

  remove_entity(entity: Entity.T): void {
    this.entities.delete(entity)
    this.traverse_left(function remove_emit_node_entities_changed(left_node) {
      left_node.emit_node_entities_changed()
    })
    for (let i = 0; i < this.type.rels.length; i++) {
      let rel_map = this.rel_maps[i]
      if (rel_map === undefined) {
        continue
      }
      rel_map.delete_object(entity)
    }
  }

  set_object(rel_id: number, subject: Entity.T, object: Entity.T): void {
    let rel_map = this.rel_maps[rel_id]
    if (rel_map === undefined) {
      return
    }
    rel_map.set_object(subject, object)
  }

  unpair(
    rel_id: number,
    subject: Entity.T,
    object: Entity.T,
  ): number | undefined {
    let rel_map = this.rel_maps[rel_id]
    if (rel_map === undefined) {
      return
    }
    return rel_map.delete(subject, object)
  }

  delete_object(rel_id: number, object: Entity.T): void {
    let rel_map = this.rel_maps[rel_id]
    if (rel_map === undefined) {
      return
    }
    rel_map.delete_object(object)
  }

  delete_subject(rel_id: number, subject: Entity.T): void {
    let rel_map = this.rel_maps[rel_id]
    if (rel_map === undefined) {
      return
    }
    rel_map.delete_subject(subject)
  }

  has_subject(rel_id: number, subject: Entity.T): boolean {
    let rel_map = this.rel_maps[rel_id]
    if (rel_map === undefined) {
      return false
    }
    return rel_map.has_subject(subject)
  }

  emit_node_entities_changed(): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i].on_node_entities_changed?.()
    }
  }

  emit_node_created(created_node: Node): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i].on_node_created?.(created_node)
    }
  }

  emit_node_disposed(disposed_node: Node): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i].on_node_disposed?.(disposed_node)
    }
  }

  link(prev_node: Node, xor = this.type.xor_hash_u(prev_node.type)): void {
    this.prev_nodes.set(xor, prev_node)
    prev_node.next_nodes.set(xor, this)
  }

  unlink(prev_node: Node, xor = this.type.xor_hash_u(prev_node.type)): void {
    this.prev_nodes.delete(xor)
    prev_node.next_nodes.delete(xor)
  }

  traverse_right(iteratee: NodeIteratee): void {
    let nodes: Node[] = [this]
    let nodes_visited = new Set<Node>()
    let i = 1
    while (i > 0) {
      let node = nodes[--i]
      if (nodes_visited.has(node) || iteratee(node) === false) {
        continue
      }
      nodes_visited.add(node)
      node.next_nodes.each_value(function traverse_next_inner(next_node) {
        nodes[i++] = next_node
      })
    }
  }

  traverse_left(iteratee: NodeIteratee): void {
    let nodes: Node[] = [this]
    let nodes_visited = new Set<Node>()
    let i = 1
    while (i > 0) {
      let node = nodes[--i]
      if (nodes_visited.has(node) || iteratee(node) === false) {
        continue
      }
      nodes_visited.add(node)
      node.prev_nodes.each_value(function traverse_prev_inner(prev_node) {
        nodes[i++] = prev_node
      })
    }
  }
}

export type T = Node

export let make = (type: Type.T = Type.empty): T => {
  return new Node(type)
}
