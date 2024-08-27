import * as Assert from "./assert"
import * as Component from "./component"
import * as Effect from "./effect"
import * as Entity from "./entity"
import * as EntityBuilder from "./entity_builder"
import * as Entities from "./entity_registry"
import * as EntityVersions from "./entity_versions"
import * as Graph from "./graph"
import * as Node from "./node"
import * as Op from "./op"
import * as Query2 from "./query_2"
import * as QueryBuilder from "./query_builder"
import * as SparseMap from "./sparse_map"
import * as SparseSet from "./sparse_set"
import * as Stage from "./stage"
import * as Transaction from "./transaction"
import * as Type from "./type"

export type Res<U> = Type.T<[Component.Ref<U>]>

export class World {
  #effects
  #entity_registry
  #gc
  #gc_at
  #nodes_to_prune
  #queries
  #resources
  #stage
  #tick
  #transaction

  readonly entity_data
  readonly entity_versions
  readonly graph
  readonly temp_data

  constructor(tick = 0) {
    this.#effects = [] as Effect.T[]
    this.#entity_registry = Entities.make()
    this.#gc = false
    this.#gc_at = undefined as number | undefined
    this.#nodes_to_prune = [] as Node.T[]
    this.#queries = new Map<QueryBuilder.T, Query2.T>()
    this.#resources = [] as unknown[]
    this.#stage = Stage.make<Op.T>()
    this.#tick = tick
    this.#transaction = Transaction.make()
    this.entity_data = [] as unknown[][]
    this.entity_versions = EntityVersions.make()
    this.graph = Graph.make()
    this.temp_data = SparseMap.make<SparseMap.T>()
  }

  get_entity_node(entity: Entity.T) {
    let node = Transaction.get_next_entity_node(this.#transaction, entity)
    Assert.ok(node !== undefined)
    return node
  }

  #bump(entity: Entity.T, component: Component.T) {
    EntityVersions.bump(this.entity_versions, entity, component.id)
  }

  #read<U extends Component.T>(entity: Entity.T, component: U) {
    let store = this.store(component.id)
    return store[entity]
  }

  #write<U extends Component.T>(
    entity: Entity.T,
    component: U,
    value: Component.ValueOf<U>,
  ) {
    let store = this.store(component.id)
    store[entity] = value
    this.#bump(entity, component)
  }

  #write_temp<U extends Component.T>(
    entity: Entity.T,
    component: U,
    value: Component.ValueOf<U>,
  ) {
    let temp_store = SparseMap.get(this.temp_data, component.id)
    if (temp_store === undefined) {
      temp_store = SparseMap.make()
      SparseMap.set(this.temp_data, component.id, temp_store)
    }
    SparseMap.set(temp_store, entity, value)
    this.#gc = true
  }

  #write_many(entity: Entity.T, type: Type.T, values: unknown[]) {
    for (let i = 0; i < type.refs.length; i++) {
      this.#write(entity, type.refs[i], values[i])
    }
  }

  #clear(entity: Entity.T, component: Component.T) {
    this.#write_temp(entity, component, this.#read(entity, component))
    this.#write(entity, component, undefined)
  }

  #clear_many(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.refs.length; i++) {
      let ref = type.refs[i]
      this.#clear(entity, ref)
    }
  }

  #despawn(entity: Entity.T) {
    let node = this.get_entity_node(entity)
    this.#clear_many(entity, node.type)
    this.#remove_relations_outbound(entity, node.type)
    Entities.release(this.#entity_registry, entity)
    Transaction.move(this.#transaction, entity)
  }

  #despawn_disposed_node_entities(node: Node.T) {
    SparseSet.each(node.entities, entity => this.#despawn(entity))
  }

  #add_relations(source_entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.pairs.length; i++) {
      let pair = type.pairs[i]
      let pair_rel_id = Entity.parse_hi(pair.id)
      let pair_rel = Component.find_by_id(pair_rel_id) as Component.Rel
      let target_entity_id = Entity.parse_lo(pair.id)
      let target_entity = Entities.hydrate(
        this.#entity_registry,
        target_entity_id,
      )
      let target_entity_node = this.get_entity_node(target_entity)
      if (!Type.has_component(target_entity_node.type, pair_rel.target)) {
        this.#apply_add(Op.add(Type.make(pair_rel.target), target_entity, []))
      }
      let next_target_entity_node = this.get_entity_node(target_entity)
      Node.set_rel_target(
        next_target_entity_node,
        pair_rel.target.id,
        source_entity,
        target_entity,
      )
    }
  }

  #remove_relations_outbound(entity: Entity.T, type: Type.T) {
    // for (let i = 0; i < type.pairs.length; i++) {
    //   let pair = type.pairs[i]
    //   let pair_rel_id = Entity.parse_hi(pair.id)
    //   let pair_rel = Component.find_by_id(pair_rel_id) as Component.Rel
    //   let pair_entity_id = Entity.parse_lo(pair.id)
    //   let pair_entity = Entities.hydrate(this.#entity_registry, pair_entity_id)
    //   let pair_entity_node = this.get_entity_node(pair_entity)
    //   Node.unset_rel_source(pair_entity_node, pair_rel.target.id, entity)
    //   if (!Node.has_rel_source(pair_entity_node, pair_rel.target.id, entity)) {
    //     this.#apply_remove(Op.remove(Type.make(pair_rel.target), pair_entity))
    //   }
    // }
  }

  #move_relations(
    target_entity: Entity.T,
    prev_node: Node.T,
    next_node: Node.T,
  ) {
    for (let i = 0; i < prev_node.type.rel_targets.length; i++) {
      let rel_target = prev_node.type.rel_targets[i]
      let rel_target_map = prev_node.rel_maps[rel_target.id]
      let rel_target_refs = rel_target_map.b_to_a[target_entity]
      if (rel_target_refs === undefined) {
        continue
      }
      SparseSet.each(rel_target_refs, source_entity => {
        Node.set_rel_target(
          next_node,
          rel_target.id,
          source_entity as Entity.T,
          target_entity,
        )
      })
      Node.unset_rel_target(prev_node, rel_target.id, target_entity)
    }
  }

  #apply_spawn(op: Op.Spawn) {
    let node = Graph.find_or_create_node_by_type(this.graph, op.type)
    this.#write_many(op.entity, op.type, op.values)
    this.#add_relations(op.entity, op.type)
    Transaction.move(this.#transaction, op.entity, node)
  }

  #apply_despawn(op: Op.Despawn) {
    this.#despawn(op.entity)
  }

  #apply_add(op: Op.Add) {
    let {entity, type, values} = op
    let prev_node = this.get_entity_node(entity)
    let next_type = Type.with(prev_node.type, type)
    let next_node = Graph.find_or_create_node_by_type(this.graph, next_type)
    this.#write_many(entity, type, values)
    this.#move_relations(entity, prev_node, next_node)
    this.#add_relations(entity, type)
    Transaction.move(this.#transaction, entity, next_node)
  }

  #apply_remove(op: Op.Remove) {
    let {entity, type} = op
    let prev_node = this.get_entity_node(entity)
    let next_type = Type.without(prev_node.type, type)
    let next_node = Graph.find_or_create_node_by_type(this.graph, next_type)
    this.#clear_many(entity, type)
    this.#move_relations(entity, prev_node, next_node)
    Transaction.move(this.#transaction, entity, next_node)
  }

  #apply_op = (op: Op.T) => {
    switch (op.kind) {
      case Op.Kind.Spawn:
        this.#apply_spawn(op)
        break
      case Op.Kind.Despawn:
        this.#apply_despawn(op)
        break
      case Op.Kind.Add:
        this.#apply_add(op)
        break
      case Op.Kind.Remove:
        this.#apply_remove(op)
        break
    }
  }

  get tick() {
    return this.#tick
  }

  has_resource<U>(res: Res<U>): boolean {
    let res_component = Type.component_at(res, 0)
    return this.#resources[res_component.id] !== undefined
  }

  set_resource<U>(res: Res<U>, resource: U) {
    let res_component = Type.component_at(res, 0)
    this.#resources[res_component.id] = resource
  }

  get_resource<U>(res: Res<U>): U {
    let res_component = Type.component_at(res, 0)
    return Assert.exists(this.#resources[res_component.id] as U)
  }

  spawn(): Entity.T
  spawn<U extends Component.T[]>(
    type: Type.Type<U>,
    ...values: Component.ValuesOf<U>
  ): Entity.T
  spawn(type?: Type.T, ...values: unknown[]): Entity.T {
    let entity = Entities.retain(this.#entity_registry)
    Stage.insert(
      this.#stage,
      this.#tick,
      Op.spawn(type ?? Type.make(), entity, values as []),
    )
    return entity
  }

  despawn(entity: Entity.T) {
    Entities.check(this.#entity_registry, entity)
    Stage.insert(this.#stage, this.#tick, Op.despawn(entity))
  }

  add<U extends Component.T[]>(
    entity: Entity.T,
    type: Type.Type<U>,
    ...values: Component.ValuesOf<U>
  ) {
    Entities.check(this.#entity_registry, entity)
    Stage.insert(this.#stage, this.#tick, Op.add(type, entity, values))
  }

  remove<U extends Component.T[]>(entity: Entity.T, type: Type.T<U>): void
  remove<U extends Component.T[]>(entity: Entity.T, type: Type.T<U>): void
  remove(entity: Entity.T, type: Type.T) {
    Entities.check(this.#entity_registry, entity)
    Stage.insert(this.#stage, this.#tick, Op.remove(type, entity))
  }

  change<U extends Component.Ref>(
    entity: Entity.T,
    ref: U,
    value: Component.ValueOf<U>,
  ) {
    this.#write(entity, ref, value)
  }

  has(entity: Entity.T, type: Type.T): boolean {
    let node = this.get_entity_node(entity)
    return Type.has(node.type, type)
  }

  get<U extends Component.Ref>(entity: Entity.T, ref: U) {
    return this.#read(entity, ref) as Component.ValueOf<U>
  }

  reset(tick: number) {
    this.#tick = tick
    this.#gc_at = undefined
    this.#gc = false
    Stage.drain_to(this.#stage, tick)
    Transaction.drain(this.#transaction)
    SparseMap.each(this.temp_data, (_, temp_data) => {
      SparseMap.clear(temp_data)
    })
  }

  step(tick: number = this.#tick + 1) {
    if (this.#gc_at !== undefined && this.#tick >= this.#gc_at) {
      SparseMap.each(this.temp_data, function gc(_, map) {
        SparseMap.clear(map)
      })
      this.#gc_at = undefined
    }
    // Execute all ops in the stage up to the given tick.
    while (this.#tick < tick) {
      Stage.drain_to(this.#stage, tick, this.#apply_op)
      this.#tick++
    }
    if (this.#gc) {
      this.#gc_at = this.#tick + 1
      this.#gc = false
    }
    // Immediately despawn all entities whose nodes are marked for deletion.
    for (let i = 0; i < this.#nodes_to_prune.length; i++) {
      let node = this.#nodes_to_prune[i]
      Node.traverse_right(node, n => this.#despawn_disposed_node_entities(n))
    }
    // Relocate entities.
    Transaction.drain(
      this.#transaction,
      function move_entity_batch(batch, prev_node, next_node) {
        SparseSet.each(batch, function moveEntity(entity) {
          if (prev_node) {
            Node.remove_entity(prev_node, entity)
          }
          if (next_node) {
            Node.insert_entity(next_node, entity)
          }
        })
      },
    )
    // Drop all nodes marked for deletion.
    let node: Node.T | undefined
    while ((node = this.#nodes_to_prune.pop())) {
      Graph.prune(this.graph, node)
    }
  }

  get_exclusive_relative<U extends Component.Rel>(
    entity: Entity.T,
    rel: Type.Unitary<U>,
  ) {
    let node = this.get_entity_node(entity)
    let rel_component = rel.vec[0] as Component.Rel
    if (rel_component.topology !== Component.Topology.Exclusive) {
      throw new Error("Expected exclusive relation")
    }
    if (!Type.has(node.type, rel)) {
      return undefined
    }
    for (let i = 0; i < node.type.pairs.length; i++) {
      let pair = node.type.pairs[i]
      let pair_id = Entity.parse_hi(pair.id)
      if (pair_id === rel_component.id) {
        return Entities.hydrate(this.#entity_registry, Entity.parse_lo(pair.id))
      }
    }
    throw new Error("Unexpected")
  }

  is_alive(entity: Entity.T) {
    return Entities.check_fast(this.#entity_registry, entity)
  }

  hydrate(entity_id: number) {
    return Entities.hydrate(this.#entity_registry, entity_id)
  }

  store(component_id: number) {
    let store = (this.entity_data[component_id] ??= [])
    if (!SparseMap.has(this.temp_data, component_id)) {
      SparseMap.set(this.temp_data, component_id, SparseMap.make())
    }
    return store
  }

  single(type: Type.Unitary): Entity.T {
    let node = Graph.find_or_create_node_by_component(
      this.graph,
      Type.component_at(type, 0),
    )
    let entity: Entity.T | undefined
    Node.traverse_right(node, visited_node => {
      if (SparseSet.size(visited_node.entities) > 0) {
        entity = SparseSet.at(visited_node.entities, 0)
        return false
      }
    })
    return Assert.exists(entity)
  }

  with<U extends Component.Tag>(component: U): EntityBuilder.T
  with<U extends Component.Ref>(
    ref: U,
    value: Component.ValueOf<U>,
  ): EntityBuilder.T
  with<U extends Component.Pair>(component: U): EntityBuilder.T
  with(component: Component.T, value?: unknown) {
    return EntityBuilder.make(
      this,
      Type.make(component),
      value === undefined ? [] : [value],
    )
  }

  for_each<U extends unknown[]>(
    query: QueryBuilder.T<U>,
    iteratee: Query2.ForEachIteratee<U>,
  ) {
    let compiled_query = this.#queries.get(query) as Query2.T<U>
    if (compiled_query === undefined) {
      compiled_query = Query2.make(query, this)
      this.#queries.set(query, compiled_query)
    }
    compiled_query.for_each(iteratee)
  }
}
export type T = World

export let make = (tick = 0): World => {
  return new World(tick)
}
