import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as SparseSet from "../sparse/sparse_set"
import * as Transition from "./transition"

type NodeIteratee = (node: Node) => boolean | void

let next_node_id = 0
let make_node_id = () => next_node_id++

export class Node {
  $created
  $excluded
  $included
  $removed
  edges_left
  edges_right
  entities
  id
  type

  constructor(type: Type.T = Type.make()) {
    this.$created = Signal.make<Node>()
    this.$excluded = Signal.make<Transition.Event>()
    this.$included = Signal.make<Transition.Event>()
    this.$removed = Signal.make<Node>()
    this.edges_left = new Map<number, Node>()
    this.edges_right = new Map<number, Node>()
    this.entities = SparseSet.make<Entity.T>()
    this.id = make_node_id()
    this.type = type
  }
}

let unlink_nodes = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor(next_node.type, prev_node.type),
): void => {
  next_node.edges_left.delete(xor)
  prev_node.edges_right.delete(xor)
}

export let insert_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.add(node.entities, entity)
}

export let remove_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.delete(node.entities, entity)
}

export let traverse = (node: Node, iteratee: NodeIteratee): void => {
  let nodes: Node[] = [node]
  let nodes_visited = new Set<Node>()
  let cursor = 1
  while (cursor > 0) {
    let curr_node = nodes[--cursor]
    if (nodes_visited.has(curr_node) || iteratee(curr_node) === false) continue
    nodes_visited.add(curr_node)
    curr_node.edges_right.forEach(function traverse_next(next_node) {
      nodes[cursor++] = next_node
    })
  }
}

export let traverse_left = (node: Node, iteratee: NodeIteratee): void => {
  let nodes: Node[] = [node]
  let nodes_visited = new Set<Node>()
  let cursor = 1
  while (cursor > 0) {
    let curr_node = nodes[--cursor]
    if (nodes_visited.has(curr_node) || iteratee(curr_node) === false) continue
    nodes_visited.add(curr_node)
    curr_node.edges_left.forEach(function traverse_left_inner(prev_node) {
      nodes[cursor++] = prev_node
    })
  }
}

let link_nodes = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor(next_node.type, prev_node.type),
): void => {
  next_node.edges_left.set(xor, prev_node)
  prev_node.edges_right.set(xor, next_node)
}

let link_nodes_deep = (graph: Graph, node: Node): void => {
  traverse(graph.root, function link_nodes_deep_traverse(visited_node) {
    if (Type.is_superset(visited_node.type, node.type)) {
      link_nodes(visited_node, node)
      return false
    }
    if (Type.is_superset(node.type, visited_node.type)) {
      // Otherwise, look ahead for nodes that are also supersets of the
      // inserted node and create an intermediate edge.
      for (let next_node of visited_node.edges_right.values()) {
        // node=[a,b,d] visited_node=[a,b]->[a,b,d,e] result=[a,b]->[a,b,d]->[a,b,d,e]
        if (Type.is_superset(next_node.type, node.type)) {
          unlink_nodes(next_node, visited_node)
          link_nodes(next_node, node)
        } else if (Type.superset_may_contain(next_node.type, node.type)) {
          return true
        }
      }
      link_nodes(node, visited_node)
      return false
    }
    return Type.superset_may_contain(visited_node.type, node.type)
  })
}

let emit_node_traverse = (node: Node): void => {
  traverse_left(node, function emit_node(visit) {
    Signal.emit(visit.$created, node)
  })
}

let insert_node = (graph: Graph, type: Type.T): Node => {
  let node: Node = graph.root
  for (let i = 0; i < type.components.length; i++) {
    let next_type = Type.with_component(node.type, type.components[i])
    let next_node = graph.nodes_by_components_hash.get(next_type.hash)
    if (next_node === undefined) {
      next_node = new Node(next_type)
      graph.nodes_by_components_hash.set(next_type.hash, next_node)
      graph.nodes_by_id[next_node.id] = next_node
      link_nodes(next_node, node, Type.xor(next_node.type, node.type))
      link_nodes_deep(graph, next_node)
      emit_node_traverse(next_node)
    }
    node = next_node
  }
  return node
}

let drop_node = (graph: Graph, node: Node): void => {
  node.edges_right.forEach(function drop_node_unlink_next(next_node, xor) {
    unlink_nodes(next_node, node, xor)
  })
  node.edges_left.forEach(function drop_node_unlink_prev(prev_node, xor) {
    unlink_nodes(node, prev_node, xor)
  })
  graph.nodes_by_components_hash.delete(node.type.hash)
  graph.nodes_by_id[node.id] = undefined!
  Signal.dispose(node.$removed)
  Signal.dispose(node.$created)
}

export let delete_node = (graph: Graph, node: Node): void => {
  let dropped_nodes: Node[] = []
  // For every node to the right of the deleted node (inclusive).
  traverse(node, function delete_node_traverse(next_node) {
    // Notify nodes to the left that it is being dropped.
    traverse_left(next_node, function delete_node_traverse_left(visit) {
      Signal.emit(visit.$removed, next_node)
    })
    dropped_nodes.push(next_node)
  })
  // Release nodes to the right of the deleted node.
  for (let i = 0; i < dropped_nodes.length; i++) {
    drop_node(graph, dropped_nodes[i])
  }
}

export let move_entities_left = (
  graph: Graph,
  node: Node,
  component: Component.T,
  iteratee: (entity: Entity.T, node: Node) => void,
): void => {
  traverse(node, function move_entities_left_traverse(next_node) {
    let prev_type = Type.without_component(next_node.type, component)
    let prev_node = resolve(graph, prev_type)
    SparseSet.each(
      next_node.entities,
      function move_entities_left_inner(entity) {
        remove_entity(next_node, entity)
        insert_entity(prev_node, entity)
        iteratee(entity, prev_node)
      },
    )
  })
}

export let resolve = (graph: Graph, type: Type.T): Node => {
  let node =
    graph.nodes_by_components_hash.get(type.hash) ?? insert_node(graph, type)
  return node
}

export let find_by_id = (graph: Graph, hash: number): Node | undefined => {
  return graph.nodes_by_id[hash]
}

class Graph {
  nodes_by_id
  nodes_by_components_hash
  root

  constructor() {
    this.root = new Node()
    this.nodes_by_id = [] as Node[]
    this.nodes_by_components_hash = new Map<number, Node>()
    this.nodes_by_components_hash.set(this.root.type.hash, this.root)
    this.nodes_by_id[this.root.id] = this.root
  }
}
export type T = Graph

export let make = (): Graph => {
  return new Graph()
}
