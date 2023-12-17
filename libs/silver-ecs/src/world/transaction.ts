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

let emitDespawnedEntities = (batch: Batch) => {
  Graph.traverseLeft(
    Assert.exists(batch.prevNode),
    function emitDespawnedEntities(visit: Graph.Node) {
      Signal.emit(visit.$excluded, batch)
    },
  )
}

let emitMovedEntities = (batch: Batch) => {
  // Find the type the source and destination nodes have in common.
  let intersection = Type.intersection(
    Assert.exists(batch.prevNode).type,
    Assert.exists(batch.nextNode).type,
  )
  Graph.traverseLeft(
    Assert.exists(batch.nextNode),
    function emitUpgradedEntities(node: Graph.Node) {
      if (
        intersection.hash === node.type.hash ||
        Type.isSuperset(intersection, node.type)
      ) {
        return false
      }
      Signal.emit(node.$included, batch)
    },
  )
  Graph.traverseLeft(
    Assert.exists(batch.prevNode),
    function emitDowngradedEntities(node: Graph.Node) {
      if (
        intersection.hash === node.type.hash ||
        Type.isSuperset(intersection, node.type)
      ) {
        return false
      }
      Signal.emit(node.$excluded, batch)
    },
  )
}

class Transaction {
  batchesByKey
  batchesByEntity
  locations

  constructor() {
    this.batchesByKey = SparseMap.make<Batch>()
    this.batchesByEntity = SparseMap.make<Batch>()
    this.locations = SparseMap.make<Graph.Node>()
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
      // Stop tracking the despawned entities' nodes.
      SparseSet.each(entities, function clearEntityNode(entity) {
        SparseMap.delete(transaction.locations, entity)
      })
      return
    }
    // Otherwise, the batch contains entities that were spawned or moved. Track
    // their new nodes.
    SparseSet.each(entities, function finalizeEntityNode(entity) {
      SparseMap.set(transaction.locations, entity, nextNode)
    })
    if (prevNode === undefined) {
      emitSpawnedEntities(batch)
    } else {
      emitMovedEntities(batch)
    }
  }
  // Emit all batches to interested nodes.
  SparseMap.eachValue(transaction.batchesByKey, emitEntityBatch)
  // Clear the transaction.
  SparseMap.clear(transaction.batchesByKey)
  SparseMap.clear(transaction.batchesByEntity)
}

export let locateNextEntityNode = (
  transaction: T,
  entity: Entity.T,
): Graph.Node | undefined =>
  SparseMap.get(transaction.batchesByEntity, entity)?.nextNode ??
  locatePrevEntityNode(transaction, entity)

export let locatePrevEntityNode = (
  transaction: T,
  entity: Entity.T,
): Graph.Node | undefined => SparseMap.get(transaction.locations, entity)

export let move = (transaction: T, entity: Entity.T, nextNode?: Graph.Node) => {
  let prevBatch = SparseMap.get(transaction.batchesByEntity, entity)
  // If the entity was already moved since the last drain, remove it from its
  // previous batch.
  if (prevBatch !== undefined) {
    SparseSet.delete(prevBatch.entities, entity)
  }
  // If the entity is being moved to the same node it was already in,
  // do nothing.
  let prevNode = locatePrevEntityNode(transaction, entity)
  if (prevNode === nextNode) {
    return
  }
  // Construct the next batch key using the previous node id, or `0`, which
  // represents the void.
  let nextBatchKey = makeBatchKey(prevNode?.id ?? 0, nextNode?.id ?? 0)
  // Get or create the next batch.
  let nextBatch = SparseMap.get(transaction.batchesByKey, nextBatchKey)
  if (nextBatch === undefined) {
    nextBatch = new Batch(prevNode, nextNode)
    SparseMap.set(transaction.batchesByKey, nextBatchKey, nextBatch)
  }
  // Add the entity to the next batch and store its key.
  SparseSet.add(nextBatch.entities, entity)
  SparseMap.set(transaction.batchesByEntity, entity, nextBatch)
}

export let make = (): T => new Transaction()
