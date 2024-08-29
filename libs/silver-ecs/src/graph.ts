import * as Component from "./component"
import * as Type from "./type"
import * as Entity from "./entity"
import * as Hash from "./hash"
import * as SparseMap from "./sparse_map"
import * as SparseSet from "./sparse_set"
import * as Node from "./node"

export class Graph {
  nodes_by_id
  nodes_by_hash
  root

  constructor() {
    this.root = Node.make()
    this.nodes_by_id = SparseMap.make<Node.T>()
    this.nodes_by_hash = new Map<number, Node.T>()
    this.nodes_by_hash.set(this.root.type.vec_hash, this.root)
    SparseMap.set(this.nodes_by_id, this.root.id, this.root)
  }
}
export type T = Graph

export let make = (): Graph => {
  return new Graph()
}

let link_nodes_traverse = (graph: Graph, inserted_node: Node.T): void => {
  Node.traverse_right(
    graph.root,
    function link_nodes_traverse_visitor(visited_node) {
      let inserted_node_is_superset_of_visited_node_supersets = false
      let inserted_node_is_superset_of_visited_node = Type.is_superset_fast(
        inserted_node.type,
        visited_node.type,
      )
      let next_nodes = SparseMap.values(visited_node.next_nodes)
      for (let i = 0; i < next_nodes.length; i++) {
        if (Type.is_superset_fast(inserted_node.type, next_nodes[i].type)) {
          inserted_node_is_superset_of_visited_node_supersets = true
          break
        }
      }
      if (
        inserted_node_is_superset_of_visited_node_supersets === false &&
        inserted_node_is_superset_of_visited_node
      ) {
        Node.link(inserted_node, visited_node)
        // continue until a node that is a superset of the inserted node is
        // found
        return true
      }
      if (Type.is_superset_fast(visited_node.type, inserted_node.type)) {
        Node.link(visited_node, inserted_node)
        // look at previous nodes and unlink connections
        SparseMap.each(
          visited_node.prev_nodes,
          function link_nodes_traverse_unlink(xor, prev_node) {
            if (Type.is_superset_fast(inserted_node.type, prev_node.type)) {
              Node.unlink(visited_node, prev_node, xor)
            }
          },
        )
        return false
      }
      return true
    },
  )
}

let emit_nodes_traverse = (node: Node.T): void => {
  Node.traverse_left(node, function emit_node(visit) {
    Node.emit_node_created(visit, node)
  })
}

let insert_node = (graph: Graph, type: Type.T): Node.T => {
  let node: Node.T = Node.make(type)
  graph.nodes_by_hash.set(type.vec_hash, node)
  SparseMap.set(graph.nodes_by_id, node.id, node)
  link_nodes_traverse(graph, node)
  emit_nodes_traverse(node)
  return node
}

let dispose_node = (graph: Graph, node: Node.T): void => {
  SparseMap.each(
    node.prev_nodes,
    function dispose_node_unlink_prev(xor, prev_node) {
      Node.unlink(node, prev_node, xor)
    },
  )
  SparseMap.each(
    node.next_nodes,
    function dispose_node_unlink_next(xor, next_node) {
      Node.unlink(next_node, node, xor)
    },
  )
  SparseMap.clear(node.prev_nodes)
  SparseMap.clear(node.next_nodes)
  graph.nodes_by_hash.delete(node.type.vec_hash)
  SparseMap.delete(graph.nodes_by_id, node.id)
  node.listeners = []
}

export let prune = (graph: Graph, node: Node.T): void => {
  let disposed_nodes: Node.T[] = []
  // For every node to the right of the deleted node (inclusive).
  Node.traverse_right(node, function prune_inner(next_node) {
    // Notify nodes to the left that it is being dropped.
    Node.traverse_left(next_node, function prune_inner_dispose(visit) {
      Node.emit_node_disposed(visit, next_node)
    })
    disposed_nodes.push(next_node)
  })
  // Release nodes to the right of the deleted node.
  for (let i = 0; i < disposed_nodes.length; i++) {
    dispose_node(graph, disposed_nodes[i])
  }
}

export let move_entities_left = (
  graph: Graph,
  node: Node.T,
  component: Component.T,
  iteratee: (entity: Entity.T, node: Node.T) => void,
): void => {
  Node.traverse_right(node, function move_entities_left_inner(next_node) {
    let prev_type = Type.without_component(next_node.type, component)
    let prev_node = find_or_create_node_by_type(graph, prev_type)
    SparseSet.each(
      next_node.entities,
      function move_entities_left_inner(entity) {
        Node.remove_entity(next_node, entity)
        Node.insert_entity(prev_node, entity)
        iteratee(entity, prev_node)
      },
    )
  })
}

export let find_or_create_node_by_type = (
  graph: Graph,
  type: Type.T,
): Node.T => {
  let node = graph.nodes_by_hash.get(type.vec_hash) ?? insert_node(graph, type)
  return node
}

export let find_or_create_node_by_component = (
  graph: Graph,
  component: Component.T,
): Node.T => {
  let node =
    graph.nodes_by_hash.get(Hash.hash_word(undefined, component.id)) ??
    insert_node(graph, Type.make([component]))
  return node
}

export let find_node_by_id = (
  graph: Graph,
  nodeId: number,
): Node.T | undefined => {
  return SparseMap.get(graph.nodes_by_id, nodeId)
}
