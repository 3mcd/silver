import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as SparseSet from "../sparse/sparse_set"
import * as Transition from "./transition"

type NodeIteratee = (node: Node) => boolean | void

let next_node_id = 0
const make_node_id = () => next_node_id++

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

const unlink_nodes = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor(next_node.type, prev_node.type),
): void => {
  next_node.edges_left.delete(xor)
  prev_node.edges_right.delete(xor)
}

const link_nodes = (
  next_node: Node,
  prev_node: Node,
  xor = Type.xor(next_node.type, prev_node.type),
): void => {
  next_node.edges_left.set(xor, prev_node)
  prev_node.edges_right.set(xor, next_node)
}

export const insert_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.add(node.entities, entity)
}

export const remove_entity = (node: Node, entity: Entity.T): void => {
  SparseSet.delete(node.entities, entity)
}

export const traverse = (node: Node, iteratee: NodeIteratee): void => {
  const stack: Node[] = [node]
  const visited = new Set<Node>()
  let cursor = 1
  while (cursor > 0) {
    const curr_node = stack[--cursor]
    if (visited.has(curr_node) || iteratee(curr_node) === false) continue
    visited.add(curr_node)
    curr_node.edges_right.forEach(function traverse_next(next_node) {
      stack[cursor++] = next_node
    })
  }
}

export const traverse_left = (node: Node, iteratee: NodeIteratee): void => {
  const stack: Node[] = [node]
  const visited = new Set<Node>()
  let cursor = 1
  while (cursor > 0) {
    const curr_node = stack[--cursor]
    if (visited.has(curr_node) || iteratee(curr_node) === false) continue
    visited.add(curr_node)
    curr_node.edges_left.forEach(function traverse_prev(prev_node) {
      stack[cursor++] = prev_node
    })
  }
}

const link_nodes_traverse = (graph: Graph, node: Node): void => {
  traverse(graph.root, function traverse_link(visited_node) {
    if (Type.is_superset(visited_node.type, node.type)) {
      link_nodes(visited_node, node)
      return false
    }
    if (Type.is_superset(node.type, visited_node.type)) {
      // Otherwise, look ahead for nodes that are also supersets of the
      // inserted node and create an intermediate edge.
      for (const next_node of visited_node.edges_right.values()) {
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

const emit_node_traverse = (node: Node): void => {
  traverse_left(node, function emit_node(visit) {
    Signal.emit(visit.$created, node)
  })
}

const insert_node = (graph: Graph, type: Type.T): Node => {
  let node: Node = graph.root
  for (let i = 0; i < type.components.length; i++) {
    const next_type = Type.with_component(node.type, type.components[i])
    let next_node = graph.nodes_by_components_hash.get(next_type.hash)
    if (next_node === undefined) {
      next_node = new Node(next_type)
      graph.nodes_by_components_hash.set(next_type.hash, next_node)
      graph.nodes_by_id[next_node.id] = next_node
      link_nodes(next_node, node, Type.xor(next_node.type, node.type))
      link_nodes_traverse(graph, next_node)
      emit_node_traverse(next_node)
    }
    node = next_node
  }
  return node
}

const drop_node = (graph: Graph, node: Node): void => {
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

export const delete_node = (graph: Graph, node: Node): void => {
  const dropped_nodes: Node[] = []
  // For every node to the right of the deleted node (inclusive).
  traverse(node, function traverse_drop(next_node) {
    // Notify nodes to the left that it is being dropped.
    traverse_left(next_node, function traverse_left_drop(visit) {
      Signal.emit(visit.$removed, next_node)
    })
    dropped_nodes.push(next_node)
  })
  // Release nodes to the right of the deleted node.
  for (let i = 0; i < dropped_nodes.length; i++) {
    drop_node(graph, dropped_nodes[i])
  }
}

export const move_entities_left = (
  graph: Graph,
  node: Node,
  component: Component.T,
  iteratee: (entity: Entity.T, node: Node) => void,
): void => {
  traverse(node, function traverse_move_entities_left(next_node) {
    const prev_type = Type.without_component(next_node.type, component)
    const prev_node = resolve(graph, prev_type)
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

export const resolve = (graph: Graph, type: Type.T): Node => {
  const node =
    graph.nodes_by_components_hash.get(type.hash) ?? insert_node(graph, type)
  return node
}

export const find_by_id = (graph: Graph, hash: number): Node | undefined => {
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
      const node_a = resolve(graph, A)
      const node_b = resolve(graph, B)
      const node_c = resolve(graph, C)
      const node_abc = resolve(graph, ABC)
      delete_node(graph, node_b)
      expect(node_a.edges_right.size).toBe(0)
      expect(node_b.edges_right.size).toBe(0)
      expect(node_c.edges_right.size).toBe(0)
      expect(node_abc.edges_left.size).toBe(0)
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
      const node_abc = resolve(graph, ABC)
      resolve(graph, B)
      resolve(graph, C)
      resolve(graph, D)
      traverse_left(node_abc, node => {
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
      const node_a = resolve(graph, A)
      const entity = Entity.make(0, 0)
      insert_entity(node_a, entity)
      expect(SparseSet.has(node_a.entities, entity)).toBe(true)
    })
    it("removes entities", () => {
      const graph = make()
      const node_a = resolve(graph, A)
      const entity = Entity.make(0, 0)
      insert_entity(node_a, entity)
      remove_entity(node_a, entity)
      expect(SparseSet.has(node_a.entities, entity)).toBe(false)
    })
    it("moves entities from the right to left", () => {
      const graph = make()
      const node_abc = resolve(graph, ABC)
      const node_ab = resolve(graph, AB)
      const entity = Entity.make(0, 0)
      const moved: Entity.T[] = []
      insert_entity(node_abc, entity)
      move_entities_left(graph, node_abc, C.components[0], entity => {
        moved.push(entity)
      })
      expect(moved.length).toBe(1)
      expect(moved).toContain(entity)
      expect(SparseSet.has(node_abc.entities, entity)).toBe(false)
      expect(SparseSet.has(node_ab.entities, entity)).toBe(true)
    })
    it("emits inserted signal", () => {
      const graph = make()
      const node_a = resolve(graph, A)
      const node_b = resolve(graph, B)
      const node_c = resolve(graph, C)
      const node_ab = resolve(graph, AB)
      const visited = {a: [], b: [], c: [], ab: []} as Record<string, Node[]>
      Signal.subscribe(node_a.$created, node => visited.a.push(node))
      Signal.subscribe(node_b.$created, node => visited.b.push(node))
      Signal.subscribe(node_c.$created, node => visited.c.push(node))
      Signal.subscribe(node_ab.$created, node => visited.ab.push(node))
      const node_bc = resolve(graph, BC)
      const node_abc = resolve(graph, ABC)
      expect(visited.a.length).toBe(1)
      expect(visited.a).toContain(node_abc)
      expect(visited.b.length).toBe(2)
      expect(visited.b).toContain(node_abc)
      expect(visited.b).toContain(node_bc)
      expect(visited.c.length).toBe(2)
      expect(visited.b).toContain(node_abc)
      expect(visited.b).toContain(node_bc)
      expect(visited.ab.length).toBe(1)
      expect(visited.ab).toContain(node_abc)
    })
    it("emits disposed signal", () => {
      const graph = make()
      const node_a = resolve(graph, A)
      const node_b = resolve(graph, B)
      const node_c = resolve(graph, C)
      const node_ab = resolve(graph, AB)
      const visited = {a: [], b: [], c: [], ab: []} as Record<string, Node[]>
      Signal.subscribe(node_a.$removed, node => visited.a.push(node))
      Signal.subscribe(node_b.$removed, node => visited.b.push(node))
      Signal.subscribe(node_c.$removed, node => visited.c.push(node))
      Signal.subscribe(node_ab.$removed, node => visited.ab.push(node))
      const node_bc = resolve(graph, BC)
      const node_abc = resolve(graph, ABC)
      delete_node(graph, node_bc)
      delete_node(graph, node_abc)
      expect(visited.a.length).toBe(1)
      expect(visited.a).toContain(node_abc)
      expect(visited.b.length).toBe(2)
      expect(visited.b).toContain(node_abc)
      expect(visited.b).toContain(node_bc)
      expect(visited.c.length).toBe(2)
      expect(visited.b).toContain(node_abc)
      expect(visited.b).toContain(node_bc)
      expect(visited.ab.length).toBe(1)
      expect(visited.ab).toContain(node_abc)
    })
  })
}
