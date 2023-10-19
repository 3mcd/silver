import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as SparseSet from "../sparse/sparse_set"
import * as Transition from "./transition"

type NodeIteratee = (node: Node) => boolean | void

let nextNodeId = 0
const makeNodeId = () => nextNodeId++

export class Node {
  $created
  $excluded
  $included
  $removed
  edgesNext
  edgesPrev
  entities
  id
  type

  constructor(type: Type.T = Type.make()) {
    this.$created = Signal.make<Node>()
    this.$excluded = Signal.make<Transition.Event>()
    this.$included = Signal.make<Transition.Event>()
    this.$removed = Signal.make<Node>()
    this.edgesNext = new Map<number, Node>()
    this.edgesPrev = new Map<number, Node>()
    this.entities = SparseSet.make<Entity.T>()
    this.id = makeNodeId()
    this.type = type
  }
}

const unlinkNodes = (
  nextNode: Node,
  prevNode: Node,
  xor = Type.xor(nextNode.type, prevNode.type),
): void => {
  nextNode.edgesPrev.delete(xor)
  prevNode.edgesNext.delete(xor)
}

const linkNodes = (
  nextNode: Node,
  prevNode: Node,
  xor = Type.xor(nextNode.type, prevNode.type),
): void => {
  nextNode.edgesPrev.set(xor, prevNode)
  prevNode.edgesNext.set(xor, nextNode)
}

export const insertEntity = (node: Node, entity: Entity.T): void => {
  SparseSet.add(node.entities, entity)
}

export const removeEntity = (node: Node, entity: Entity.T): void => {
  SparseSet.delete(node.entities, entity)
}

export const traverse = (node: Node, iteratee: NodeIteratee): void => {
  const stack: Node[] = [node]
  const visited = new Set<Node>()
  let cursor = 1
  while (cursor > 0) {
    const currNode = stack[--cursor]
    if (visited.has(currNode) || iteratee(currNode) === false) continue
    visited.add(currNode)
    currNode.edgesNext.forEach(function traverseNext(nextNode) {
      stack[cursor++] = nextNode
    })
  }
}

export const traversePrev = (node: Node, iteratee: NodeIteratee): void => {
  const stack: Node[] = [node]
  const visited = new Set<Node>()
  let cursor = 1
  while (cursor > 0) {
    const currNode = stack[--cursor]
    if (visited.has(currNode) || iteratee(currNode) === false) continue
    visited.add(currNode)
    currNode.edgesPrev.forEach(function traversePrev(prevNode) {
      stack[cursor++] = prevNode
    })
  }
}

const linkNodesTraverse = (graph: Graph, node: Node): void => {
  traverse(graph.root, function traverseLink(visitedNode) {
    if (Type.isSuperset(visitedNode.type, node.type)) {
      linkNodes(visitedNode, node)
      return false
    }
    if (Type.isSuperset(node.type, visitedNode.type)) {
      // Otherwise, look ahead for nodes that are also supersets of the
      // inserted node and create an intermediate edge.
      for (const nextNode of visitedNode.edgesNext.values()) {
        // node=[a,b,d] visitedNode=[a,b]->[a,b,d,e] result=[a,b]->[a,b,d]->[a,b,d,e]
        if (Type.isSuperset(nextNode.type, node.type)) {
          unlinkNodes(nextNode, visitedNode)
          linkNodes(nextNode, node)
        } else if (Type.supersetMayContain(nextNode.type, node.type)) {
          return true
        }
      }
      linkNodes(node, visitedNode)
      return false
    }
    return Type.supersetMayContain(visitedNode.type, node.type)
  })
}

const emitNodeTraverse = (node: Node): void => {
  traversePrev(node, function emitNode(visit) {
    Signal.emit(visit.$created, node)
  })
}

const insertNode = (graph: Graph, type: Type.T): Node => {
  let node: Node = graph.root
  for (let i = 0; i < type.components.length; i++) {
    const nextType = Type.withComponent(node.type, type.components[i])
    let nextNode = graph.nodesByComponentsHash.get(nextType.hash)
    if (nextNode === undefined) {
      nextNode = new Node(nextType)
      graph.nodesByComponentsHash.set(nextType.hash, nextNode)
      graph.nodesById[nextNode.id] = nextNode
      linkNodes(nextNode, node, Type.xor(nextNode.type, node.type))
      linkNodesTraverse(graph, nextNode)
      emitNodeTraverse(nextNode)
    }
    node = nextNode
  }
  return node
}

const dropNode = (graph: Graph, node: Node): void => {
  node.edgesNext.forEach(function dropNodeUnlinkNext(nextNode, xor) {
    unlinkNodes(nextNode, node, xor)
  })
  node.edgesPrev.forEach(function dropNodeUnlinkPrev(prevNode, xor) {
    unlinkNodes(node, prevNode, xor)
  })
  graph.nodesByComponentsHash.delete(node.type.hash)
  graph.nodesById[node.id] = undefined!
  Signal.dispose(node.$removed)
  Signal.dispose(node.$created)
}

export const deleteNode = (graph: Graph, node: Node): void => {
  const droppedNodes: Node[] = []
  // for every node to the right of the deleted node (inclusive)
  traverse(node, function traverseDrop(nextNode) {
    // notify nodes to the left that it is being dropped
    traversePrev(nextNode, function traverseRemDrop(visit) {
      Signal.emit(visit.$removed, nextNode)
    })
    droppedNodes.push(nextNode)
  })
  // release nodes to the right of the deleted node
  for (let i = 0; i < droppedNodes.length; i++) {
    dropNode(graph, droppedNodes[i])
  }
}

export const moveEntitiesRem = (
  graph: Graph,
  node: Node,
  component: Component.T,
  iteratee: (entity: Entity.T, node: Node) => void,
): void => {
  traverse(node, function traverseMoveEntitiesRem(nextNode) {
    const prevType = Type.withoutComponent(nextNode.type, component)
    const prevNode = resolve(graph, prevType)
    SparseSet.each(nextNode.entities, function moveEntitiesRemInner(entity) {
      removeEntity(nextNode, entity)
      insertEntity(prevNode, entity)
      iteratee(entity, prevNode)
    })
  })
}

export const resolve = (graph: Graph, type: Type.T): Node => {
  const node =
    graph.nodesByComponentsHash.get(type.hash) ?? insertNode(graph, type)
  return node
}

export const findById = (graph: Graph, hash: number): Node | undefined => {
  return graph.nodesById[hash]
}

class Graph {
  nodesById
  nodesByComponentsHash
  root

  constructor() {
    this.root = new Node()
    this.nodesById = [] as Node[]
    this.nodesByComponentsHash = new Map<number, Node>()
    this.nodesByComponentsHash.set(this.root.type.hash, this.root)
    this.nodesById[this.root.id] = this.root
  }
}
export type T = Graph

export const make = (): Graph => {
  return new Graph()
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")
  const A = Component.value()
  const B = Component.value()
  const C = Component.value()
  const D = Component.value()
  const AB = Type.make(A, B)
  const BC = Type.make(B, C)
  const ABC = Type.make(A, B, C)
  describe("Graph", () => {
    it("inserts nodes", () => {
      const graph = make()
      expect(resolve(graph, A)).toBe(resolve(graph, A))
      expect(resolve(graph, ABC)).toBe(resolve(graph, ABC))
    })
    it("unlinks nodes adjacent to deleted ones", () => {
      const graph = make()
      const nodeA = resolve(graph, A)
      const nodeB = resolve(graph, B)
      const nodeC = resolve(graph, C)
      const nodeAbc = resolve(graph, ABC)
      deleteNode(graph, nodeB)
      expect(nodeA.edgesNext.size).toBe(0)
      expect(nodeB.edgesNext.size).toBe(0)
      expect(nodeC.edgesNext.size).toBe(0)
      expect(nodeAbc.edgesPrev.size).toBe(0)
    })
    it("traverses nodes left to right", () => {
      const graph = make()
      const visited: number[] = []
      resolve(graph, ABC)
      resolve(graph, B)
      resolve(graph, C)
      traverse(graph.root, node => {
        visited.push(node.type.hash)
      })
      expect(visited.length).toBe(6)
      expect(visited).toContain(graph.root.type.hash)
      expect(visited).toContain(A.hash)
      expect(visited).toContain(AB.hash)
      expect(visited).toContain(ABC.hash)
      expect(visited).toContain(B.hash)
      expect(visited).toContain(C.hash)
    })
    it("traverses nodes right to left", () => {
      const graph = make()
      const visited: number[] = []
      const nodeAbc = resolve(graph, ABC)
      resolve(graph, B)
      resolve(graph, C)
      resolve(graph, D)
      traversePrev(nodeAbc, node => {
        visited.push(node.type.hash)
      })
      expect(visited.length).toBe(6)
      expect(visited).toContain(graph.root.type.hash)
      expect(visited).toContain(A.hash)
      expect(visited).toContain(AB.hash)
      expect(visited).toContain(ABC.hash)
      expect(visited).toContain(B.hash)
      expect(visited).toContain(C.hash)
    })
    it("inserts entities", () => {
      const graph = make()
      const nodeA = resolve(graph, A)
      const entity = Entity.make(0, 0)
      insertEntity(nodeA, entity)
      expect(SparseSet.has(nodeA.entities, entity)).toBe(true)
    })
    it("removes entities", () => {
      const graph = make()
      const nodeA = resolve(graph, A)
      const entity = Entity.make(0, 0)
      insertEntity(nodeA, entity)
      removeEntity(nodeA, entity)
      expect(SparseSet.has(nodeA.entities, entity)).toBe(false)
    })
    it("moves entities from the right to left", () => {
      const graph = make()
      const nodeAbc = resolve(graph, ABC)
      const nodeAb = resolve(graph, AB)
      const entity = Entity.make(0, 0)
      const moved: Entity.T[] = []
      insertEntity(nodeAbc, entity)
      moveEntitiesRem(graph, nodeAbc, C.components[0], entity => {
        moved.push(entity)
      })
      expect(moved.length).toBe(1)
      expect(moved).toContain(entity)
      expect(SparseSet.has(nodeAbc.entities, entity)).toBe(false)
      expect(SparseSet.has(nodeAb.entities, entity)).toBe(true)
    })
    it("emits inserted signal", () => {
      const graph = make()
      const nodeA = resolve(graph, A)
      const nodeB = resolve(graph, B)
      const nodeC = resolve(graph, C)
      const nodeAb = resolve(graph, AB)
      const visited = {a: [], b: [], c: [], ab: []} as Record<string, Node[]>
      Signal.subscribe(nodeA.$created, node => visited.a.push(node))
      Signal.subscribe(nodeB.$created, node => visited.b.push(node))
      Signal.subscribe(nodeC.$created, node => visited.c.push(node))
      Signal.subscribe(nodeAb.$created, node => visited.ab.push(node))
      const nodeBc = resolve(graph, BC)
      const nodeAbc = resolve(graph, ABC)
      expect(visited.a.length).toBe(1)
      expect(visited.a).toContain(nodeAbc)
      expect(visited.b.length).toBe(2)
      expect(visited.b).toContain(nodeAbc)
      expect(visited.b).toContain(nodeBc)
      expect(visited.c.length).toBe(2)
      expect(visited.b).toContain(nodeAbc)
      expect(visited.b).toContain(nodeBc)
      expect(visited.ab.length).toBe(1)
      expect(visited.ab).toContain(nodeAbc)
    })
    it("emits disposed signal", () => {
      const graph = make()
      const nodeA = resolve(graph, A)
      const nodeB = resolve(graph, B)
      const nodeC = resolve(graph, C)
      const nodeAb = resolve(graph, AB)
      const visited = {a: [], b: [], c: [], ab: []} as Record<string, Node[]>
      Signal.subscribe(nodeA.$removed, node => visited.a.push(node))
      Signal.subscribe(nodeB.$removed, node => visited.b.push(node))
      Signal.subscribe(nodeC.$removed, node => visited.c.push(node))
      Signal.subscribe(nodeAb.$removed, node => visited.ab.push(node))
      const nodeBc = resolve(graph, BC)
      const nodeAbc = resolve(graph, ABC)
      deleteNode(graph, nodeBc)
      deleteNode(graph, nodeAbc)
      expect(visited.a.length).toBe(1)
      expect(visited.a).toContain(nodeAbc)
      expect(visited.b.length).toBe(2)
      expect(visited.b).toContain(nodeAbc)
      expect(visited.b).toContain(nodeBc)
      expect(visited.c.length).toBe(2)
      expect(visited.b).toContain(nodeAbc)
      expect(visited.b).toContain(nodeBc)
      expect(visited.ab.length).toBe(1)
      expect(visited.ab).toContain(nodeAbc)
    })
  })
}
