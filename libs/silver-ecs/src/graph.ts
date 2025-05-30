import {debug} from "#logger"
import * as Component from "./component.ts"
import * as Hash from "./hash.ts"
import * as Node from "./node.ts"
import * as SparseMap from "./sparse_map.ts"
import * as Type from "./type.ts"

export class Graph {
  nodes_by_id
  nodes_by_hash
  root

  constructor() {
    this.root = Node.make()
    this.nodes_by_id = SparseMap.make<Node.t>()
    this.nodes_by_hash = new Map<number, Node.t>()
    this.nodes_by_hash.set(this.root.type.vec_hash, this.root)
    this.nodes_by_id.set(this.root.id, this.root)
  }

  link_nodes_traverse(inserted_node: Node.t): void {
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

  emit_nodes_traverse(node: Node.t): void {
    node.traverse_left(function emit_node(visit) {
      visit.emit_node_created(node)
    })
  }

  insert_node(type: Type.t): Node.t {
    let node: Node.t = Node.make(type)
    this.nodes_by_hash.set(type.vec_hash, node)
    this.nodes_by_id.set(node.id, node)
    this.link_nodes_traverse(node)
    this.emit_nodes_traverse(node)
    DEBUG: {
      debug("graph", {event: "insert_node", node: node.toJSON()})
    }
    return node
  }

  find_or_create_node_by_type(type: Type.t): Node.t {
    let node = this.nodes_by_hash.get(type.vec_hash) ?? this.insert_node(type)
    return node
  }

  find_or_create_node_by_component(component: Component.t): Node.t {
    let node =
      this.nodes_by_hash.get(Hash.hash_word(undefined, component.id)) ??
      this.insert_node(Type.make([component]))
    return node
  }

  find_node_by_id(node_id: number): Node.t | undefined {
    return this.nodes_by_id.get(node_id)
  }
}

export type t = Graph

export let make = (): Graph => {
  return new Graph()
}
