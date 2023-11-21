import * as Graph from "./graph"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as Type from "../data/type"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import {exists} from "../assert"

export type Iteratee = (
  batch: SparseSet.T<Entity.T>,
  prevNode?: Graph.Node,
  nextNode?: Graph.Node,
) => void

let makeBatchKey = (prevNodeId: number, nextNodeId: number) =>
  (BigInt(nextNodeId) << 32n) | BigInt(prevNodeId)

let decomposeBatchKeyNext = (key: bigint) =>
  Number((key & 0xffffffff00000000n) >> 32n)

let decomposeBatchKeyPrev = (key: bigint) => Number(key & 0xffffffffn)

export class Event {
  phase
  entities
  node

  constructor(phase: string, entities: Entity.T[], node: Graph.Node) {
    this.phase = phase
    this.entities = entities
    this.node = node
  }
}

let makeMoveEvent = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  node: Graph.Node,
): Event => {
  return new Event(phase, SparseSet.values(entities), node)
}

let emitSpawnedEntities = (
  phase: string,
  batch: SparseSet.T<Entity.T>,
  nextNode: Graph.Node,
) => {
  let event = makeMoveEvent(phase, batch, nextNode)
  Graph.traverseLeft(
    nextNode,
    function emitSpawnedEntities(node: Graph.Node) {
      Signal.emit(node.$included, event)
    },
  )
}

let emitIncludedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  let event = makeMoveEvent(phase, entities, nextNode)
  Graph.traverseLeft(
    nextNode,
    function emitIncludedEntities(node: Graph.Node) {
      if (node !== prevNode && !Type.isSuperset(prevNode.type, node.type)) {
        Signal.emit(node.$included, event)
      }
    },
  )
}

let emitExcludedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  let event = makeMoveEvent(phase, entities, prevNode)
  Graph.traverseLeft(
    prevNode,
    function emitExcludedEntities(node: Graph.Node) {
      if (node !== nextNode && !Type.isSuperset(nextNode.type, node.type)) {
        Signal.emit(node.$excluded, event)
      }
    },
  )
}

let emitDespawnedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
) => {
  let event = makeMoveEvent(phase, entities, prevNode)
  Graph.traverseLeft(
    prevNode,
    function emitDespawnedEntities(node: Graph.Node) {
      Signal.emit(node.$excluded, event)
    },
  )
}

let emitMovedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  let included = makeMoveEvent(phase, entities, nextNode)
  let excluded = makeMoveEvent(phase, entities, prevNode)
  Graph.traverseLeft(
    nextNode,
    function emitIncludedEntities(node: Graph.Node) {
      Signal.emit(node.$included, included)
    },
  )
  Graph.traverseLeft(
    prevNode,
    function emitExcludedEntities(node: Graph.Node) {
      Signal.emit(node.$excluded, excluded)
    },
  )
}

class Transition {
  entityIndex
  entityBatches

  constructor() {
    this.entityIndex = SparseMap.make<bigint>()
    this.entityBatches = new Map<bigint, SparseSet.T<Entity.T>>()
  }
}
export type T = Transition

export let drain = (
  transition: T,
  graph: Graph.T,
  phase: string,
  iteratee?: Iteratee,
) => {
  if (transition.entityBatches.size === 0) {
    return
  }
  let emitEntities = (entities: SparseSet.T<Entity.T>, batchKey: bigint) => {
    let prevNodeId = decomposeBatchKeyPrev(batchKey)
    let nextNodeId = decomposeBatchKeyNext(batchKey)
    let prevNode = Graph.findById(graph, prevNodeId)
    let nextNode = Graph.findById(graph, nextNodeId)
    iteratee?.(entities, prevNode, nextNode)
    if (prevNode && prevNode !== graph.root) {
      if (nextNodeId === graph.root.id) {
        emitDespawnedEntities(phase, entities, prevNode)
      } else {
        let nextNode = exists(Graph.findById(graph, nextNodeId))
        if (Type.isSuperset(nextNode.type, prevNode.type)) {
          emitIncludedEntities(phase, entities, prevNode, nextNode)
        } else if (Type.isSuperset(prevNode.type, nextNode.type)) {
          emitExcludedEntities(phase, entities, prevNode, nextNode)
        } else {
          emitMovedEntities(phase, entities, prevNode, nextNode)
        }
      }
    } else {
      emitSpawnedEntities(phase, entities, exists(nextNode))
    }
  }
  transition.entityBatches.forEach(emitEntities)
  transition.entityBatches.clear()
  SparseMap.clear(transition.entityIndex)
}

export let locate = (transition: T, entity: Entity.T): number | undefined => {
  let currBatchKey = SparseMap.get(transition.entityIndex, entity)
  if (currBatchKey === undefined) {
    return
  }
  return decomposeBatchKeyNext(currBatchKey)
}

export let move = (
  transition: T,
  entity: Entity.T,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  let prevBatchKey = SparseMap.get(transition.entityIndex, entity) ?? 0n
  let prevBatch = transition.entityBatches.get(prevBatchKey)
  if (prevBatch !== undefined) {
    SparseSet.delete(prevBatch, entity)
  }
  let nextBatchKey = makeBatchKey(prevNode.id, nextNode.id)
  let nextBatch = transition.entityBatches.get(nextBatchKey)
  if (nextBatch === undefined) {
    nextBatch = SparseSet.make()
    transition.entityBatches.set(nextBatchKey, nextBatch)
  }
  SparseSet.add(nextBatch, entity)
  SparseMap.set(transition.entityIndex, entity, nextBatchKey)
}

export let make = (): T => new Transition()
