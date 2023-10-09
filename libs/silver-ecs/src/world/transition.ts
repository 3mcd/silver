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

const makeBatchKey = (prevNodeId: number, nextNodeId: number) =>
  (BigInt(nextNodeId) << 31n) | BigInt(prevNodeId)

const decomposeBatchKeyNext = (key: bigint) =>
  Number((key & 0xffffffff00000000n) >> 31n)

const decomposeBatchKeyPrev = (key: bigint) => Number(key & 0xffffffffn)

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

const makeMoveEvent = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  node: Graph.Node,
): Event => {
  return new Event(phase, SparseSet.values(entities), node)
}

const emitSpawnedEntities = (
  phase: string,
  batch: SparseSet.T<Entity.T>,
  nextNode: Graph.Node,
) => {
  const event = makeMoveEvent(phase, batch, nextNode)
  Graph.traversePrev(nextNode, function emitSpawnedEntities(node: Graph.Node) {
    Signal.emit(node.$included, event)
  })
}

const emitIncludedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  const event = makeMoveEvent(phase, entities, nextNode)
  Graph.traversePrev(nextNode, function emitIncludedEntities(node: Graph.Node) {
    if (node !== prevNode && !Type.isSuperset(prevNode.type, node.type)) {
      Signal.emit(node.$included, event)
    }
  })
}

const emitExcludedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  const event = makeMoveEvent(phase, entities, prevNode)
  Graph.traversePrev(prevNode, function emitExcludedEntities(node: Graph.Node) {
    if (node !== nextNode && !Type.isSuperset(node.type, nextNode.type)) {
      Signal.emit(node.$excluded, event)
    }
  })
}

const emitDespawnedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
) => {
  const event = makeMoveEvent(phase, entities, prevNode)
  Graph.traversePrev(
    prevNode,
    function emitDespawnedEntities(node: Graph.Node) {
      Signal.emit(node.$excluded, event)
    },
  )
}

const emitMovedEntities = (
  phase: string,
  entities: SparseSet.T<Entity.T>,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  const included = makeMoveEvent(phase, entities, nextNode)
  const excluded = makeMoveEvent(phase, entities, prevNode)
  Graph.traversePrev(nextNode, function emitIncludedEntities(node: Graph.Node) {
    Signal.emit(node.$included, included)
  })
  Graph.traversePrev(prevNode, function emitExcludedEntities(node: Graph.Node) {
    Signal.emit(node.$excluded, excluded)
  })
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

export const drain = (
  transition: T,
  graph: Graph.T,
  phase: string,
  iteratee?: Iteratee,
) => {
  if (transition.entityBatches.size === 0) {
    return
  }
  const emitEntities = (entities: SparseSet.T<Entity.T>, batchKey: bigint) => {
    const prevNodeId = decomposeBatchKeyPrev(batchKey)
    const nextNodeId = decomposeBatchKeyNext(batchKey)
    const prevNode = Graph.findById(graph, prevNodeId)
    const nextNode = Graph.findById(graph, nextNodeId)
    iteratee?.(entities, prevNode, nextNode)
    if (prevNode && prevNode !== graph.root) {
      if (nextNodeId === graph.root.id) {
        emitDespawnedEntities(phase, entities, prevNode)
      } else {
        const nextNode = exists(Graph.findById(graph, nextNodeId))
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

export const locate = (transition: T, entity: Entity.T): number | undefined => {
  const currBatchKey = SparseMap.get(transition.entityIndex, entity)
  if (currBatchKey === undefined) {
    return
  }
  return decomposeBatchKeyNext(currBatchKey)
}

export const move = (
  transition: T,
  entity: Entity.T,
  prevNode: Graph.Node,
  nextNode: Graph.Node,
) => {
  const prevBatchKey = SparseMap.get(transition.entityIndex, entity) ?? 0n
  const prevBatch = transition.entityBatches.get(prevBatchKey)
  if (prevBatch !== undefined) {
    SparseSet.delete(prevBatch, entity)
  }
  const nextBatchKey = makeBatchKey(prevNode.id, nextNode.id)
  let nextBatch = transition.entityBatches.get(nextBatchKey)
  if (nextBatch === undefined) {
    nextBatch = SparseSet.make()
    transition.entityBatches.set(nextBatchKey, nextBatch)
  }
  SparseSet.add(nextBatch, entity)
  SparseMap.set(transition.entityIndex, entity, nextBatchKey)
}

export const make = (): T => new Transition()
