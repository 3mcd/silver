import {assert_exists} from "./assert.ts"
import * as Entity from "./entity.ts"
import * as Hash from "./hash.ts"
import * as Node from "./node.ts"
import * as SparseMap from "./sparse_map.ts"
import * as SparseSet from "./sparse_set.ts"

export type Iteratee = (
  batch: SparseSet.T<Entity.t>,
  prev_node?: Node.t,
  next_node?: Node.t,
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

  constructor(prev_node?: Node.t, next_node?: Node.t) {
    this.entities = SparseSet.make<Entity.t>()
    this.prev_node = prev_node
    this.next_node = next_node
  }

  add(entity: Entity.t) {
    this.entities.add(entity)
  }

  delete(entity: Entity.t) {
    this.entities.delete(entity)
  }

  each(callback: (entity: Entity.t) => void) {
    this.entities.for_each(callback)
  }
}

let emit_spawned_entities = (batch: Batch) => {
  let next_node = assert_exists(batch.next_node)
  next_node.traverse_left(function emit_spawned_entities(visit: Node.t) {
    visit.emit_entities_in(batch)
  })
}

let emit_despawned_entities = (batch: Batch) => {
  let prev_node = assert_exists(batch.prev_node)
  prev_node.traverse_left(function emit_despawned_entities_inner(
    visit: Node.t,
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
  next_node.traverse_left(function emit_upgraded_entities(visit: Node.t) {
    if (
      intersection.vec_hash === visit.type.vec_hash ||
      intersection.is_superset(visit.type)
    ) {
      return false
    }
    visit.emit_entities_in(batch)
  })
  prev_node.traverse_left(function emit_downgraded_entities(node: Node.t) {
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
    this.targets_by_entity = SparseMap.make<Node.t>()
  }

  apply() {
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
        let clear_entity_node = (entity: Entity.t) => {
          this.targets_by_entity.delete(entity)
        }
        batch.each(clear_entity_node)
        return
      }
      // Otherwise, the batch contains entities that were spawned or moved. Track
      // their new nodes.
      let finalize_entity_node = (entity: Entity.t) => {
        this.targets_by_entity.set(entity, next_node)
      }
      batch.each(finalize_entity_node)
      if (prev_node === undefined) {
        emit_spawned_entities(batch)
      } else {
        emit_moved_entities(batch)
      }
    }
    // Emit all batches to interested nodes.
    this.batches_by_key.each_value(emit_entity_batch)
    // Clear the this.
    this.batches_by_key.clear()
    this.batches_by_entity.clear()
  }

  get_prev_entity_node(entity: Entity.t): Node.t | undefined {
    return this.targets_by_entity.get(entity)
  }

  get_next_entity_node(entity: Entity.t): Node.t | undefined {
    return (
      this.batches_by_entity.get(entity)?.next_node ??
      this.get_prev_entity_node(entity)
    )
  }

  move(entity: Entity.t, next_node?: Node.t) {
    let prev_batch = this.batches_by_entity.get(entity)
    // If the entity was already moved since the last drain, remove it from its
    // previous batch.
    if (prev_batch !== undefined) {
      prev_batch.delete(entity)
    }
    // If the entity is being moved to the same node it was already in,
    // do nothing.
    let prev_node = this.get_prev_entity_node(entity)
    if (prev_node === next_node) {
      return
    }
    // Construct the next batch key using the previous node id, or `0`, which
    // implies deletion.
    let next_batch_key = make_batch_key(prev_node?.id ?? 0, next_node?.id ?? 0)
    // Get or create the next batch.
    let next_batch = this.batches_by_key.get(next_batch_key)
    if (next_batch === undefined) {
      next_batch = new Batch(prev_node, next_node)
      this.batches_by_key.set(next_batch_key, next_batch)
    }
    // Add the entity to the next batch and store its key.
    next_batch.add(entity)
    this.batches_by_entity.set(entity, next_batch)
  }
}

export type t = Stage

export let make = (): t => {
  return new Stage()
}
