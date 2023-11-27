import * as Graph from "./graph"
import * as Entity from "../entity/entity"
import * as Signal from "../signal"
import * as Type from "../data/type"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Assert from "../assert"
import * as Hash from "../hash"

export type Iteratee = (
  batch: SparseSet.T<Entity.T>,
  prevNode?: Graph.Node,
  nextNode?: Graph.Node,
) => void

let makeBatchKey = (prevNodeId: number, nextNodeId: number) => {
  return Hash.word(Hash.word(undefined, prevNodeId), nextNodeId) >>> 0
}

export class Batch {
  entities
  prevNode
  nextNode

  constructor(prevNode?: Graph.Node, nextNode?: Graph.Node) {
    this.entities = SparseSet.make<Entity.T>()
    this.prevNode = prevNode
    this.nextNode = nextNode
  }
}

let emitSpawnedEntities = (batch: Batch) => {
  Graph.traverseLeft(
    Assert.exists(batch.nextNode),
    function emitSpawnedEntities(visit: Graph.Node) {
      Signal.emit(visit.$included, batch)
    },
  )
}

let emitIncludedEntities = (batch: Batch) => {
  let prevNode = Assert.exists(batch.prevNode)
  Graph.traverseLeft(
    Assert.exists(batch.nextNode),
    function emitIncludedEntities(visit: Graph.Node) {
      if (visit !== prevNode && !Type.isSuperset(prevNode.type, visit.type)) {
        Signal.emit(visit.$included, batch)
      }
    },
  )
}

let emitExcludedEntities = (batch: Batch) => {
  let nextNode = Assert.exists(batch.nextNode)
  Graph.traverseLeft(
    Assert.exists(batch.prevNode),
    function emitExcludedEntities(visit: Graph.Node) {
      if (visit !== nextNode && !Type.isSuperset(nextNode.type, visit.type)) {
        Signal.emit(visit.$excluded, batch)
      }
    },
  )
}

let emitDespawnedEntities = (batch: Batch) => {
  Graph.traverseLeft(
    Assert.exists(batch.prevNode),
    function emitDespawnedEntities(visit: Graph.Node) {
      Signal.emit(visit.$excluded, batch)
    },
  )
}

let emitMovedEntities = (batch: Batch) => {
  Graph.traverseLeft(
    Assert.exists(batch.nextNode),
    function emitIncludedEntities(node: Graph.Node) {
      Signal.emit(node.$included, batch)
    },
  )
  Graph.traverseLeft(
    Assert.exists(batch.prevNode),
    function emitExcludedEntities(node: Graph.Node) {
      Signal.emit(node.$excluded, batch)
    },
  )
}

class Transaction {
  index
  batchKeys
  batches

  constructor() {
    this.index = SparseMap.make<Graph.Node>()
    this.batchKeys = SparseMap.make<number>()
    this.batches = SparseMap.make<Batch>()
  }
}
export type T = Transaction

export let drain = (transaction: T, iteratee?: Iteratee) => {
  let emitEntityBatch = (batch: Batch) => {
    let {entities, prevNode, nextNode} = batch
    // Invoke the iteratee for this batch.
    iteratee?.(entities, prevNode, nextNode)
    // If the next node is undefined, the batch contains entities that were
    // despawned.
    if (nextNode === undefined) {
      emitDespawnedEntities(batch)
      // Remove the entities from the entity index.
      SparseSet.each(entities, function drainEntities(entity) {
        SparseMap.delete(transaction.index, entity)
      })
      return
    }
    // Otherwise, the batch contains entities that were spawned or moved. So
    // update their locations in the entity index.
    SparseSet.each(entities, function drainEntities(entity) {
      SparseMap.set(transaction.index, entity, nextNode)
    })
    if (prevNode === undefined) {
      emitSpawnedEntities(batch)
    } else if (Type.isSuperset(nextNode.type, prevNode.type)) {
      emitIncludedEntities(batch)
    } else if (Type.isSuperset(prevNode.type, nextNode.type)) {
      emitExcludedEntities(batch)
    } else {
      emitMovedEntities(batch)
    }
  }
  SparseMap.eachValue(transaction.batches, emitEntityBatch)
  SparseMap.clear(transaction.batches)
  SparseMap.clear(transaction.batchKeys)
}

export let locate = (
  transaction: T,
  entity: Entity.T,
): Graph.Node | undefined => SparseMap.get(transaction.index, entity)

export let move = (transaction: T, entity: Entity.T, nextNode?: Graph.Node) => {
  let prevBatchKey = SparseMap.get(transaction.batchKeys, entity)
  // If the entity was already moved since the last drain,
  if (prevBatchKey !== undefined) {
    // Remove it from its previous batch.
    let prevBatch = Assert.exists(
      SparseMap.get(transaction.batches, prevBatchKey),
    )
    SparseSet.delete(prevBatch.entities, entity)
  }
  // If the entity is being moved to the same node it was already in,
  // do nothing.
  let prevNode = locate(transaction, entity)
  if (prevNode === nextNode) {
    return
  }
  // Construct the next batch key using the previous node id, or `0`, which
  // represents the void.
  let nextBatchKey = makeBatchKey(prevNode?.id ?? 0, nextNode?.id ?? 0)
  // Get or create the next batch.
  let nextBatch = SparseMap.get(transaction.batches, nextBatchKey)
  if (nextBatch === undefined) {
    nextBatch = new Batch(prevNode, nextNode)
    SparseMap.set(transaction.batches, nextBatchKey, nextBatch)
  }
  // Add the entity to the next batch and store its key.
  SparseSet.add(nextBatch.entities, entity)
  SparseMap.set(transaction.batchKeys, entity, nextBatchKey)
}

export let make = (): T => new Transaction()
