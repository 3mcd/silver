import * as Component from "./component"
import * as Entity from "./entity"
import * as Hash from "./hash"
import * as Node from "./node"
import * as SparseMap from "./sparse_map"
import * as Type from "./type"

export class Graph {
  nodes_by_id
  nodes_by_hash
  root

  constructor() {
    this.root = Node.make()
    this.nodes_by_id = SparseMap.make<Node.T>()
    this.nodes_by_hash = new Map<number, Node.T>()
    this.nodes_by_hash.set(this.root.type.vec_hash, this.root)
    this.nodes_by_id.set(this.root.id, this.root)
  }

  link_nodes_traverse(inserted_node: Node.T): void {
    this.root.traverse_right(function link_nodes_traverse_visitor(
      visited_node,
    ) {
      let inserted_node_is_superset_of_visited_node_supersets = false
      let inserted_node_is_superset_of_visited_node =
        inserted_node.type.is_superset(visited_node.type)
      let next_nodes = visited_node.next_nodes.values()
      for (let i = 0; i < next_nodes.length; i++) {
        if (inserted_node.type.is_superset(next_nodes[i].type)) {
          inserted_node_is_superset_of_visited_node_supersets = true
          break
        }
      }
      if (
        inserted_node_is_superset_of_visited_node_supersets === false &&
        inserted_node_is_superset_of_visited_node
      ) {
        inserted_node.link(visited_node)
        return true
      }
      if (visited_node.type.is_superset(inserted_node.type)) {
        visited_node.link(inserted_node)
        visited_node.prev_nodes.for_each(function link_nodes_traverse_unlink(
          xor,
          prev_node,
        ) {
          if (inserted_node.type.is_superset(prev_node.type)) {
            visited_node.unlink(prev_node, xor)
          }
        })
        return false
      }
      return true
    })
  }

  emit_nodes_traverse(node: Node.T): void {
    node.traverse_left(function emit_node(visit) {
      visit.emit_node_created(node)
    })
  }

  insert_node(type: Type.T): Node.T {
    let node: Node.T = Node.make(type)
    this.nodes_by_hash.set(type.vec_hash, node)
    this.nodes_by_id.set(node.id, node)
    this.link_nodes_traverse(node)
    this.emit_nodes_traverse(node)
    return node
  }

  dispose_node(node: Node.T): void {
    node.prev_nodes.for_each(function dispose_node_unlink_prev(xor, prev_node) {
      node.unlink(prev_node, xor)
    })
    node.next_nodes.for_each(function dispose_node_unlink_next(xor, next_node) {
      next_node.unlink(node, xor)
    })
    node.prev_nodes.clear()
    node.next_nodes.clear()
    this.nodes_by_hash.delete(node.type.vec_hash)
    this.nodes_by_id.delete(node.id)
    node.listeners = []
  }

  prune(node: Node.T): void {
    let disposed_nodes: Node.T[] = []
    node.traverse_right(function prune_inner(next_node) {
      next_node.traverse_left(function prune_inner_dispose(visit) {
        visit.emit_node_disposed(next_node)
      })
      disposed_nodes.push(next_node)
    })
    for (let i = 0; i < disposed_nodes.length; i++) {
      this.dispose_node(disposed_nodes[i])
    }
  }

  move_entities_left(
    node: Node.T,
    component: Component.T,
    iteratee: (entity: Entity.T, node: Node.T) => void,
  ): void {
    node.traverse_right(next_node => {
      let prev_type = next_node.type.without_component(component)
      let prev_node = this.find_or_create_node_by_type(prev_type)
      next_node.entities.each(entity => {
        next_node.remove_entity(entity)
        prev_node.insert_entity(entity)
        iteratee(entity, prev_node)
      })
    })
  }

  find_or_create_node_by_type(type: Type.T): Node.T {
    let node = this.nodes_by_hash.get(type.vec_hash) ?? this.insert_node(type)
    return node
  }

  find_or_create_node_by_component(component: Component.T): Node.T {
    let node =
      this.nodes_by_hash.get(Hash.hash_word(undefined, component.id)) ??
      this.insert_node(Type.make([component]))
    return node
  }

  find_node_by_id(node_id: number): Node.T | undefined {
    return this.nodes_by_id.get(node_id)
  }
}

export type T = Graph

export let make = (): Graph => {
  return new Graph()
}
