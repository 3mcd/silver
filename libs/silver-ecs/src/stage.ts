import {assert_exists} from "./assert"
import * as Entity from "./entity"
import * as Hash from "./hash"
import * as Node from "./node"
import * as SparseMap from "./sparse_map"
import * as SparseSet from "./sparse_set"

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

  add(entity: Entity.T) {
    this.entities.add(entity)
  }

  delete(entity: Entity.T) {
    this.entities.delete(entity)
  }

  each(callback: (entity: Entity.T) => void) {
    this.entities.each(callback)
  }
}

let emit_spawned_entities = (batch: Batch) => {
  let next_node = assert_exists(batch.next_node)
  next_node.traverse_left(function emit_spawned_entities(visit: Node.T) {
    visit.emit_entities_in(batch)
  })
}

let emit_despawned_entities = (batch: Batch) => {
  let prev_node = assert_exists(batch.prev_node)
  prev_node.traverse_left(function emit_despawned_entities_inner(
    visit: Node.T,
  ) {
    visit.emit_entities_out(batch)
  })
}

let emit_moved_entities = (batch: Batch) => {
  let prev_node = assert_exists(batch.prev_node)
  let next_node = assert_exists(batch.next_node)
  // Find the type the source and destination nodes have in common.
  let intersection = prev_node.type.from_intersection(
    assert_exists(batch.next_node).type,
  )
  next_node.traverse_left(function emit_upgraded_entities(visit: Node.T) {
    if (
      intersection.vec_hash === visit.type.vec_hash ||
      intersection.is_superset(visit.type)
    ) {
      return false
    }
    visit.emit_entities_in(batch)
  })
  prev_node.traverse_left(function emit_downgraded_entities(node: Node.T) {
    if (
      intersection.vec_hash === node.type.vec_hash ||
      intersection.is_superset(node.type)
    ) {
      return false
    }
    node.emit_entities_out(batch)
  })
}

class Stage {
  batches_by_key
  batches_by_entity
  targets_by_entity

  constructor() {
    this.batches_by_key = SparseMap.make<Batch>()
    this.batches_by_entity = SparseMap.make<Batch>()
    this.targets_by_entity = SparseMap.make<Node.T>()
  }
}
export type T = Stage

export let apply = (stage: T) => {
  let emit_entity_batch = (batch: Batch) => {
    let {entities, prev_node, next_node} = batch
    // Invoke the iteratee for this batch.
    batch.each(function move_entity(entity) {
      if (prev_node) {
        prev_node.remove_entity(entity)
      }
      if (next_node) {
        next_node.insert_entity(entity)
      }
    })
    // If the next node is undefined, the batch contains entities that were
    // despawned.
    if (next_node === undefined) {
      emit_despawned_entities(batch)
      // Stop tracking the despawned entities' nodes.
      batch.each(function clear_entity_node(entity) {
        stage.targets_by_entity.delete(entity)
      })
      return
    }
    // Otherwise, the batch contains entities that were spawned or moved. Track
    // their new nodes.
    batch.each(function finalize_entity_node(entity) {
      stage.targets_by_entity.set(entity, next_node)
    })
    if (prev_node === undefined) {
      emit_spawned_entities(batch)
    } else {
      emit_moved_entities(batch)
    }
  }
  // Emit all batches to interested nodes.
  stage.batches_by_key.each_value(emit_entity_batch)
  // Clear the stage.
  stage.batches_by_key.clear()
  stage.batches_by_entity.clear()
}

export let get_prev_entity_node = (
  stage: T,
  entity: Entity.T,
): Node.T | undefined => stage.targets_by_entity.get(entity)

export let get_next_entity_node = (
  stage: T,
  entity: Entity.T,
): Node.T | undefined =>
  stage.batches_by_entity.get(entity)?.next_node ??
  get_prev_entity_node(stage, entity)

export let move = (stage: T, entity: Entity.T, next_node?: Node.T) => {
  let prev_batch = stage.batches_by_entity.get(entity)
  // If the entity was already moved since the last drain, remove it from its
  // previous batch.
  if (prev_batch !== undefined) {
    prev_batch.delete(entity)
  }
  // If the entity is being moved to the same node it was already in,
  // do nothing.
  let prev_node = get_prev_entity_node(stage, entity)
  if (prev_node === next_node) {
    return
  }
  // Construct the next batch key using the previous node id, or `0`, which
  // implies deletion.
  let next_batch_key = make_batch_key(prev_node?.id ?? 0, next_node?.id ?? 0)
  // Get or create the next batch.
  let next_batch = stage.batches_by_key.get(next_batch_key)
  if (next_batch === undefined) {
    next_batch = new Batch(prev_node, next_node)
    stage.batches_by_key.set(next_batch_key, next_batch)
  }
  // Add the entity to the next batch and store its key.
  next_batch.add(entity)
  stage.batches_by_entity.set(entity, next_batch)
}

export let make = (): T => {
  return new Stage()
}
