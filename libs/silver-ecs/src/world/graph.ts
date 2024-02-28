import * as Hash from "../hash"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Transition from "./transaction"

type NodeIteratee = (node: Node) => boolean | void

let next_node_id = 1
let make_node_id = () => next_node_id++

export class Node {
  $changed
  $created
  $excluded
  $included
  $disposed
  edges_prev
  edges_next
  entities
  id
  disposed
  type

  constructor(type: Type.T = Type.make()) {
    this.$changed = Signal.make()
    this.$created = Signal.make<Node>()
    this.$excluded = Signal.make<Transition.Batch>()
    this.$included = Signal.make<Transition.Batch>()
    this.$disposed = Signal.make<Node>()
    this.edges_prev = new Map<number, Node>()
    this.edges_next = new Map<number, Node>()
    this.entities = SparseSet.make<Entity.T>()
    this.id = make_node_id()
    this.disposed = false
    this.type = type
  }
}

let unlink_nodes = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor_hash(next_node.type, prev_node.type),
): void => {
  next_node.edges_prev.delete(xor)
  prev_node.edges_next.delete(xor)
}

export let insert_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.add(node.entities, entity)
  traverse_left(node, function insert_entity_inner(visit) {
    Signal.emit(visit.$changed, null)
  })
}

export let remove_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.delete(node.entities, entity)
  traverse_left(node, function remove_entity_inner(visit) {
    Signal.emit(visit.$changed, null)
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
    node.edges_next.forEach(function traverse_next_inner(next_node) {
      nodes[i++] = next_node
    })
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
    node.edges_prev.forEach(function traverse_prev_inner(prev_node) {
      nodes[i++] = prev_node
    })
  }
}

let link_nodes = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor_hash(next_node.type, prev_node.type),
): void => {
  next_node.edges_prev.set(xor, prev_node)
  prev_node.edges_next.set(xor, next_node)
}

let link_nodes_traverse = (graph: Graph, node: Node): void => {
  traverse_right(graph.root, function linkNodesDeepTraverse(visitedNode) {
    let visitedNodeHasSupersets = false
    for (let next_node of visitedNode.edges_next.values()) {
      if (Type.is_superset(node.type, next_node.type)) {
        visitedNodeHasSupersets = true
      }
    }
    if (
      visitedNodeHasSupersets === false &&
      Type.is_superset(node.type, visitedNode.type)
    ) {
      link_nodes(node, visitedNode)
      return Type.is_left(node.type, visitedNode.type)
    } else if (Type.is_superset(visitedNode.type, node.type)) {
      link_nodes(visitedNode, node)
      return false
    }
    return true
  })
}

let emit_nodes_traverse = (node: Node): void => {
  traverse_left(node, function emitNode(visit) {
    Signal.emit(visit.$created, node)
  })
}

let insert_node = (graph: Graph, type: Type.T): Node => {
  let node: Node = new Node(type)
  graph.nodes_by_hash.set(type.hash, node)
  SparseMap.set(graph.nodes_by_id, node.id, node)
  link_nodes_traverse(graph, node)
  emit_nodes_traverse(node)
  return node
}

let dispose_node = (graph: Graph, node: Node): void => {
  node.edges_next.forEach(function disposeNodeUnlinkNext(next_node, xor) {
    unlink_nodes(next_node, node, xor)
  })
  node.edges_prev.forEach(function disposeNodeUnlinkPrev(prev_node, xor) {
    unlink_nodes(node, prev_node, xor)
  })
  node.edges_prev.clear()
  node.edges_next.clear()
  graph.nodes_by_hash.delete(node.type.hash)
  SparseMap.delete(graph.nodes_by_id, node.id)
  Signal.dispose(node.$disposed)
  Signal.dispose(node.$created)
  Signal.dispose(node.$changed)
  Signal.dispose(node.$included)
  Signal.dispose(node.$excluded)
  Signal.dispose(node.$disposed)
  node.disposed = true
}

export let prune = (graph: Graph, node: Node): void => {
  let disposed_nodes: Node[] = []
  // For every node to the right of the deleted node (inclusive).
  traverse_right(node, function prune_inner(next_node) {
    // Notify nodes to the left that it is being dropped.
    traverse_left(next_node, function prune_inner_dispose(visit) {
      Signal.emit(visit.$disposed, next_node)
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
  node: Node,
  component: Component.T,
  iteratee: (entity: Entity.T, node: Node) => void,
): void => {
  traverse_right(node, function move_entities_left_inner(next_node) {
    let prev_type = Type.without_component(next_node.type, component)
    let prev_node = resolve_node_by_type(graph, prev_type)
    SparseSet.each(next_node.entities, function moveEntitiesLeftInner(entity) {
      remove_entity(next_node, entity)
      insert_entity(prev_node, entity)
      iteratee(entity, prev_node)
    })
  })
}

export let resolve_node_by_type = (graph: Graph, type: Type.T): Node => {
  let node = graph.nodes_by_hash.get(type.hash) ?? insert_node(graph, type)
  return node
}

export let resolve_node_by_component = (
  graph: Graph,
  component: Component.T,
): Node => {
  let node =
    graph.nodes_by_hash.get(Hash.hash_word(undefined, component.id)) ??
    insert_node(graph, Type.make(component))
  return node
}

export let find_node_by_id = (
  graph: Graph,
  nodeId: number,
): Node | undefined => {
  return SparseMap.get(graph.nodes_by_id, nodeId)
}

export class Graph {
  nodes_by_id
  nodes_by_hash
  root

  constructor() {
    this.root = new Node()
    this.nodes_by_id = SparseMap.make<Node>()
    this.nodes_by_hash = new Map<number, Node>()
    this.nodes_by_hash.set(this.root.type.hash, this.root)
    SparseMap.set(this.nodes_by_id, this.root.id, this.root)
  }
}
export type T = Graph

export let make = (): Graph => {
  return new Graph()
}
