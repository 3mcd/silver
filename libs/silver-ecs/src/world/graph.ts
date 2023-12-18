import * as Hash from "../hash"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Transition from "./transaction"

type NodeIteratee = (node: Node) => boolean | void

let nextNodeId = 1
let makeNodeId = () => nextNodeId++

export class Node {
  $changed
  $created
  $excluded
  $included
  $dropped
  edgesLeft
  edgesRight
  entities
  id
  isDropped
  type

  constructor(type: Type.T = Type.make()) {
    this.$changed = Signal.make()
    this.$created = Signal.make<Node>()
    this.$excluded = Signal.make<Transition.Batch>()
    this.$included = Signal.make<Transition.Batch>()
    this.$dropped = Signal.make<Node>()
    this.edgesLeft = new Map<number, Node>()
    this.edgesRight = new Map<number, Node>()
    this.entities = SparseSet.make<Entity.T>()
    this.id = makeNodeId()
    this.isDropped = false
    this.type = type
  }
}

let unlinkNodes = (
  nextNode: Node,
  prevNode: Node,
  xor = Type.xorHash(nextNode.type, prevNode.type),
): void => {
  nextNode.edgesLeft.delete(xor)
  prevNode.edgesRight.delete(xor)
}

export let insertEntity = (node: Node, entity: Entity.T): void => {
  SparseSet.add(node.entities, entity)
  traverseLeft(node, function insertEntityTraverseLeft(visit) {
    Signal.emit(visit.$changed, null)
  })
}

export let removeEntity = (node: Node, entity: Entity.T): void => {
  SparseSet.delete(node.entities, entity)
  traverseLeft(node, function insertEntityTraverseLeft(visit) {
    Signal.emit(visit.$changed, null)
  })
}

export let traverse = (node: Node, iteratee: NodeIteratee): void => {
  let nodes = [node]
  let nodesVisited = new Set<Node>()
  let i = 1
  while (i > 0) {
    let currNode = nodes[--i]
    if (nodesVisited.has(currNode) || iteratee(currNode) === false) continue
    nodesVisited.add(currNode)
    currNode.edgesRight.forEach(function traverseNext(nextNode) {
      nodes[i++] = nextNode
    })
  }
}

export let traverseLeft = (node: Node, iteratee: NodeIteratee): void => {
  let nodes = [node]
  let nodesVisited = new Set<Node>()
  let i = 1
  while (i > 0) {
    let currNode = nodes[--i]
    if (nodesVisited.has(currNode) || iteratee(currNode) === false) continue
    nodesVisited.add(currNode)
    currNode.edgesLeft.forEach(function traverseLeftInner(prevNode) {
      nodes[i++] = prevNode
    })
  }
}

let linkNodes = (
  nextNode: Node,
  prevNode: Node,
  xor = Type.xorHash(nextNode.type, prevNode.type),
): void => {
  nextNode.edgesLeft.set(xor, prevNode)
  prevNode.edgesRight.set(xor, nextNode)
}

let linkNodesDeep = (graph: Graph, node: Node): void => {
  traverse(graph.root, function linkNodesDeepTraverse(visitedNode) {
    let visitedNodeHasSupersets = false
    for (let nextNode of visitedNode.edgesRight.values()) {
      if (Type.isSuperset(node.type, nextNode.type)) {
        visitedNodeHasSupersets = true
      }
    }
    if (
      visitedNodeHasSupersets === false &&
      Type.isSuperset(node.type, visitedNode.type)
    ) {
      linkNodes(node, visitedNode)
      return Type.supersetMayContain(node.type, visitedNode.type)
    } else if (Type.isSuperset(visitedNode.type, node.type)) {
      linkNodes(visitedNode, node)
      return false
    }
    return true
  })
}

let emitNodeTraverse = (node: Node): void => {
  traverseLeft(node, function emitNode(visit) {
    Signal.emit(visit.$created, node)
  })
}

let insertNode = (graph: Graph, type: Type.T): Node => {
  let node: Node = new Node(type)
  graph.nodesByHash.set(type.hash, node)
  SparseMap.set(graph.nodesById, node.id, node)
  linkNodesDeep(graph, node)
  emitNodeTraverse(node)
  return node
}

let dropNode = (graph: Graph, node: Node): void => {
  node.edgesRight.forEach(function dropNodeUnlinkNext(nextNode, xor) {
    unlinkNodes(nextNode, node, xor)
  })
  node.edgesLeft.forEach(function dropNodeUnlinkPrev(prevNode, xor) {
    unlinkNodes(node, prevNode, xor)
  })
  node.edgesLeft.clear()
  node.edgesRight.clear()
  graph.nodesByHash.delete(node.type.hash)
  SparseMap.delete(graph.nodesById, node.id)
  Signal.dispose(node.$dropped)
  Signal.dispose(node.$created)
  Signal.dispose(node.$changed)
  Signal.dispose(node.$included)
  Signal.dispose(node.$excluded)
  Signal.dispose(node.$dropped)
  node.isDropped = true
}

export let pruneNode = (graph: Graph, node: Node): void => {
  let droppedNodes: Node[] = []
  // For every node to the right of the deleted node (inclusive).
  traverse(node, function deleteNodeTraverse(nextNode) {
    // Notify nodes to the left that it is being dropped.
    traverseLeft(nextNode, function deleteNodeTraverseLeft(visit) {
      Signal.emit(visit.$dropped, nextNode)
    })
    droppedNodes.push(nextNode)
  })
  // Release nodes to the right of the deleted node.
  for (let i = 0; i < droppedNodes.length; i++) {
    dropNode(graph, droppedNodes[i])
  }
}

export let moveEntitiesLeft = (
  graph: Graph,
  node: Node,
  component: Component.T,
  iteratee: (entity: Entity.T, node: Node) => void,
): void => {
  traverse(node, function moveEntitiesLeftTraverse(nextNode) {
    let prevType = Type.withoutComponent(nextNode.type, component)
    let prevNode = resolve(graph, prevType)
    SparseSet.each(nextNode.entities, function moveEntitiesLeftInner(entity) {
      removeEntity(nextNode, entity)
      insertEntity(prevNode, entity)
      iteratee(entity, prevNode)
    })
  })
}

export let resolve = (graph: Graph, type: Type.T): Node => {
  let node = graph.nodesByHash.get(type.hash) ?? insertNode(graph, type)
  return node
}

export let resolveByComponent = (
  graph: Graph,
  component: Component.T,
): Node => {
  let node =
    graph.nodesByHash.get(Hash.word(undefined, component.id)) ??
    insertNode(graph, Type.make(component))
  return node
}

export let findById = (graph: Graph, nodeId: number): Node | undefined => {
  return SparseMap.get(graph.nodesById, nodeId)
}

export class Graph {
  nodesById
  nodesByHash
  root

  constructor() {
    this.root = new Node()
    this.nodesById = SparseMap.make<Node>()
    this.nodesByHash = new Map<number, Node>()
    this.nodesByHash.set(this.root.type.hash, this.root)
    SparseMap.set(this.nodesById, this.root.id, this.root)
  }
}
export type T = Graph

export let make = (): Graph => {
  return new Graph()
}
