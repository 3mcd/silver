import * as Assert from "./assert"
import * as Type from "./type"
import * as Entity from "./entity"
import * as Hash from "./hash"
import * as SparseMap from "./sparse_map"
import * as SparseSet from "./sparse_set"
import * as Node from "./node"

export type Iteratee = (
  batch: SparseSet.T<Entity.T>,
  prev_node?: Node.T,
  next_node?: Node.T,
) => void

let make_batch_key = (prev_node_id: number, next_node_id: number) => {
  return Hash.as_uint(
    Hash.hash_word(Hash.hash_word(undefined, prev_node_id), next_node_id),
  )
}

export class Batch {
  entities
  prev_node
  next_node

  constructor(prev_node?: Node.T, next_node?: Node.T) {
    this.entities = SparseSet.make<Entity.T>()
    this.prev_node = prev_node
    this.next_node = next_node
  }
}

let emit_spawned_entities = (batch: Batch) => {
  Node.traverse_left(
    Assert.exists(batch.next_node),
    function emit_spawned_entities(visit: Node.T) {
      Node.emit_entities_in(visit, batch)
    },
  )
}

let emit_despawned_entities = (batch: Batch) => {
  Node.traverse_left(
    Assert.exists(batch.prev_node),
    function emit_despawned_entities_inner(visit: Node.T) {
      Node.emit_entities_out(visit, batch)
    },
  )
}

let emit_moved_entities = (batch: Batch) => {
  // Find the type the source and destination nodes have in common.
  let intersection = Type.intersection(
    Assert.exists(batch.prev_node).type,
    Assert.exists(batch.next_node).type,
  )
  Node.traverse_left(
    Assert.exists(batch.next_node),
    function emit_upgraded_entities(visit: Node.T) {
      if (
        intersection.hash === visit.type.hash ||
        Type.is_superset(intersection, visit.type)
      ) {
        return false
      }
      Node.emit_entities_in(visit, batch)
    },
  )
  Node.traverse_left(
    Assert.exists(batch.prev_node),
    function emit_downgraded_entities(node: Node.T) {
      if (
        intersection.hash === node.type.hash ||
        Type.is_superset(intersection, node.type)
      ) {
        return false
      }
      Node.emit_entities_out(node, batch)
    },
  )
}

class Transaction {
  batches_by_key
  batches_by_entity
  locations

  constructor() {
    this.batches_by_key = SparseMap.make<Batch>()
    this.batches_by_entity = SparseMap.make<Batch>()
    this.locations = SparseMap.make<Node.T>()
  }
}
export type T = Transaction

export let drain = (transaction: T, iteratee?: Iteratee) => {
  let emit_entity_batch = (batch: Batch) => {
    let {entities, prev_node, next_node} = batch
    // Invoke the iteratee for this batch.
    iteratee?.(entities, prev_node, next_node)
    // If the next node is undefined, the batch contains entities that were
    // despawned.
    if (next_node === undefined) {
      emit_despawned_entities(batch)
      // Stop tracking the despawned entities' nodes.
      SparseSet.each(entities, function clear_entity_node(entity) {
        SparseMap.delete(transaction.locations, entity)
      })
      return
    }
    // Otherwise, the batch contains entities that were spawned or moved. Track
    // their new nodes.
    SparseSet.each(entities, function finalize_entity_node(entity) {
      SparseMap.set(transaction.locations, entity, next_node)
    })
    if (prev_node === undefined) {
      emit_spawned_entities(batch)
    } else {
      emit_moved_entities(batch)
    }
  }
  // Emit all batches to interested nodes.
  SparseMap.each_value(transaction.batches_by_key, emit_entity_batch)
  // Clear the transaction.
  SparseMap.clear(transaction.batches_by_key)
  SparseMap.clear(transaction.batches_by_entity)
}

export let get_prev_entity_node = (
  transaction: T,
  entity: Entity.T,
): Node.T | undefined => SparseMap.get(transaction.locations, entity)

export let get_next_entity_node = (
  transaction: T,
  entity: Entity.T,
): Node.T | undefined =>
  SparseMap.get(transaction.batches_by_entity, entity)?.next_node ??
  get_prev_entity_node(transaction, entity)

export let move = (transaction: T, entity: Entity.T, next_node?: Node.T) => {
  let prev_batch = SparseMap.get(transaction.batches_by_entity, entity)
  // If the entity was already moved since the last drain, remove it from its
  // previous batch.
  if (prev_batch !== undefined) {
    SparseSet.delete(prev_batch.entities, entity)
  }
  // If the entity is being moved to the same node it was already in,
  // do nothing.
  let prev_node = get_prev_entity_node(transaction, entity)
  if (prev_node === next_node) {
    return
  }
  // Construct the next batch key using the previous node id, or `0`, which
  // implies deletion.
  let next_batch_key = make_batch_key(prev_node?.id ?? 0, next_node?.id ?? 0)
  // Get or create the next batch.
  let next_batch = SparseMap.get(transaction.batches_by_key, next_batch_key)
  if (next_batch === undefined) {
    next_batch = new Batch(prev_node, next_node)
    SparseMap.set(transaction.batches_by_key, next_batch_key, next_batch)
  }
  // Add the entity to the next batch and store its key.
  SparseSet.add(next_batch.entities, entity)
  SparseMap.set(transaction.batches_by_entity, entity, next_batch)
}

export let make = (): T => {
  return new Transaction()
}
