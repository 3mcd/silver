import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as EntityBuilder from "../entity/entity_builder"
import * as Entities from "../entity/entity_registry"
import * as EntityVersions from "../entity/entity_versions"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Stage from "../stage"
import * as Op from "./op"
import * as Graph from "./graph"
import * as Transaction from "./transaction"
import * as Query from "../query/query"
import * as Effect from "./effect"
import * as Node from "./node"

export type Res<U> = Type.T<[Component.Ref<U>]>

export class World implements Node.Listener {
  #effects
  #entity_registry
  #entity_pair_roots
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
    this.#entity_pair_roots = [] as Node.T[][]
    this.#entity_registry = Entities.make()
    this.#gc = false
    this.#gc_at = undefined as number | undefined
    this.#nodes_to_prune = [] as Node.T[]
    this.#queries = new Map<Query.T, Query.CompiledQuery>()
    this.#resources = [] as unknown[]
    this.#stage = Stage.make<Op.T>()
    this.#tick = tick
    this.#transaction = Transaction.make()
    this.entity_data = [] as unknown[][]
    this.entity_versions = EntityVersions.make()
    this.graph = Graph.make()
    this.temp_data = SparseMap.make<SparseMap.T>()
    Node.add_listener(this.graph.root, this)
  }

  on_node_created(node: Node.T): void {
    this.#record_relation_node(node)
  }

  #locate(entity: Entity.T) {
    let node = Transaction.locate_next_entity_node(this.#transaction, entity)
    Assert.ok(node !== undefined)
    return node
  }

  /**
   * Increment the version of a component for a given entity.
   */
  #bump(entity: Entity.T, component: Component.T) {
    EntityVersions.bump(this.entity_versions, entity, component.id)
  }

  /**
   * Get the value of a component for a given entity.
   */
  #read<U extends Component.T>(entity: Entity.T, component: U) {
    return this.store(component.id)[entity]
  }

  /**
   * Set the value of a component for a given entity and bump the entity's
   * version at that component.
   */
  #write<U extends Component.T>(
    entity: Entity.T,
    component: U,
    value: Op.InitSingle<U>,
  ) {
    this.store(component.id)[entity] = value
    this.#bump(entity, component)
  }

  /**
   * Update the data of a value pair for a given entity.
   */
  #write_pair<U extends Component.RefRelation>(
    entity: Entity.T,
    component: U,
    relative: Entity.T,
    value: unknown,
  ) {
    // Compute the virtual component id for the pair. This id is unique to the
    // pair between the component and the relative. All entities associated to
    // with the relative through this component will store their values in the
    // same component array.
    let pair_id = Entity.make(Entity.parse_lo(relative), component.id)
    this.store(pair_id)[entity] = value
    this.#bump(entity, component)
  }

  #write_temp<U extends Component.T>(
    entity: Entity.T,
    component: U,
    value: Op.InitSingle<U>,
  ) {
    let store = SparseMap.get(this.temp_data, component.id)
    if (store === undefined) {
      store = SparseMap.make()
      SparseMap.set(this.temp_data, component.id, store)
    }
    SparseMap.set(store, entity, value)
    this.#gc = true
  }

  /**
   * Update an entity's component values.
   */
  #write_many(entity: Entity.T, type: Type.T, values: unknown[]) {
    for (let i = 0; i < type.refs.length; i++) {
      this.#write(entity, type.refs[i], values[i])
    }
  }

  #clear(entity: Entity.T, component: Component.T) {
    this.#write_temp(entity, component, this.#read(entity, component))
    this.#write(entity, component, undefined)
  }

  /**
   * Clear an entity's component values for a given type.
   */
  #clear_many(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.refs.length; i++) {
      let ref = type.refs[i]
      this.#clear(entity, ref)
    }
  }

  /**
   * Insert a new entity into the entity graph and write initial component
   * values.
   */
  #apply_spawn(op: Op.Spawn) {
    let {entity, type, init} = op
    let node = Graph.resolve_node_by_type(this.graph, type)
    this.#write_many(entity, type, init)
    Transaction.move(this.#transaction, entity, node)
  }

  /**
   * Remove an entity from the entity graph and clear all component values and
   * pairs.
   */
  #apply_despawn(op: Op.Despawn) {
    this.#despawn(op.entity)
  }

  #despawn = (entity: Entity.T) => {
    let node = this.#locate(entity)
    this.#clear_many(entity, node.type)
    this.#clear_entity_pairs(entity)
    Entities.release(this.#entity_registry, entity)
    Transaction.move(this.#transaction, entity)
  }

  #despawn_disposed_node_entities = (node: Node.T) => {
    SparseSet.each(node.entities, this.#despawn)
  }

  /**
   * Add or update a component for an entity.
   */
  #apply_add(op: Op.Add) {
    let {entity, type, init} = op
    let prev_node = this.#locate(entity)
    let next_type = Type.with(prev_node.type, type)
    let next_node = Graph.resolve_node_by_type(this.graph, next_type)
    this.#write_many(entity, type, init)
    Transaction.move(this.#transaction, entity, next_node)
  }

  /**
   * Remove components from an entity.
   */
  #apply_remove(op: Op.Remove) {
    let {entity, type} = op
    let prev_node = this.#locate(entity)
    let next_type = Type.without(prev_node.type, type)
    let next_node = Graph.resolve_node_by_type(this.graph, next_type)
    this.#clear_many(entity, type)
    Transaction.move(this.#transaction, entity, next_node)
  }

  /**
   * Marshal pair nodes into a map indexed by the pair's entity id. This map is
   * used to dispose an entity's pair nodes when the entity is despawned.
   */
  #record_relation_node = (node: Node.T) => {
    for (let i = 0; i < node.type.pairs.length; i++) {
      let pair = node.type.pairs[i]
      let pair_entity_id = Entity.parse_lo(pair.id)
      let pair_entity = Entities.hydrate(this.#entity_registry, pair_entity_id)
      // Get or create the root pair node and insert it into the entity's list
      // of pair nodes.
      let pair_roots = (this.#entity_pair_roots[pair_entity] ??= [])
      let pair_root = Graph.resolve_node_by_component(this.graph, pair)
      // TODO: Use a Set or something faster than Array.prototype.includes.
      if (!pair_roots.includes(pair_root)) {
        pair_roots.push(pair_root)
      }
    }
  }

  /**
   * Remove all pair nodes associated with an entity and move related entities
   * to the left in the graph.
   */
  #clear_entity_pairs(entity: Entity.T) {
    // Look up nodes that lead to the entity's relatives.
    let pair_roots = this.#entity_pair_roots[entity]
    if (pair_roots === undefined) {
      return
    }
    for (let i = 0; i < pair_roots.length; i++) {
      let pair_root = pair_roots[i]
      let pair = Type.component_at(pair_root.type, 0) as Component.TPair
      let pair_component_id = Entity.parse_hi(pair.id)
      let pair_component = Assert.exists(
        Component.find_by_id(pair_component_id),
      )
      // If the pair is inclusive (i.e. not hierarchical), remove the pair from
      // all related entities.
      if (
        (pair_component as Component.TRelation).topology ===
        Component.Topology.Inclusive
      ) {
        Graph.move_entities_left(
          this.graph,
          pair_root,
          pair,
          (entity, node) => {
            Transaction.move(this.#transaction, entity, node)
            this.#write(entity, pair, undefined)
          },
        )
      }
      // Delete the root pair node, which will also delete all pair nodes that
      // lead to the entity's relatives.
      this.#nodes_to_prune.push(pair_root)
    }
    this.#entity_pair_roots[entity] = undefined!
  }

  /**
   * Apply a single op.
   */
  #apply_op = (op: Op.T) => {
    switch (op.kind) {
      case "spawn":
        this.#apply_spawn(op)
        break
      case "despawn":
        this.#apply_despawn(op)
        break
      case "add":
        this.#apply_add(op)
        break
      case "remove":
        this.#apply_remove(op)
        break
    }
  }

  /**
   * Get the current tick (i.e. logical timestamp or frame).
   */
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

  /**
   * Create an entity with no components.
   *
   * @example
   * <caption>Create an container entity.</caption>
   * ```ts
   * let InContainer = relation(S.Topology.Exclusive)
   * let Item = type(InContainer)
   * let bag = world.spawn()
   * let item = world.spawn(Item, bag)
   * ```
   */
  spawn(): Entity.T
  /**
   * Create an entity with a given type and initial component values.
   * @example
   * <caption>Create an entity with a position and velocity.</caption>
   * ```ts
   * let Position = ref()
   * let Velocity = ref()
   * let entity = world.spawn(type(Position, Velocity), {x: 0, y: 0}, {x: 1, y: 1})
   * ```
   * @example
   * <caption>Create an entity with a rotation and a spectating relationship.</caption>
   * ```ts
   * let Spectating = rel()
   * let Spectator = type(Rotation, Spectating)
   * let entity = world.spawn(Spectator, [Quaternion.from(playerRotation), player])
   * ```
   */
  spawn<U extends Component.T[]>(
    type: Type.Type<U>,
    ...values: Op.Init<U>
  ): Entity.T
  spawn(type?: Type.T, ...values: Op.Init): Entity.T {
    let entity = Entities.retain(this.#entity_registry)
    Stage.insert(
      this.#stage,
      this.#tick,
      Op.spawn(
        type ?? Type.make(),
        entity,
        type ? Op.init(type, values) : values,
      ),
    )
    return entity
  }

  /**
   * Despawn an entity, releasing its component values.
   *
   * If the despawned entity is related to other entities through an exclusive
   * relation, those entities will be despawned as well.
   *
   * @example
   * <caption>Delete an entity.</caption>
   * ```ts
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.despawn(entity)
   * world.step()
   * world.has(entity, Position) // false
   * ```
   * @example
   * <caption>Delete an entity with relationships.</caption>
   * ```ts
   * let Orbits = rel()
   * let DockedTo = relation(S.Topology.Exclusive)
   * let planet = world.spawn()
   * let station = world.spawn(Orbits, planet)
   * let spaceship = world.spawn(DockedTo, station)
   * world.despawn(planet) // despawns only `planet`
   * world.despawn(station) // despawns both `station` and `spaceship`
   * ```
   */
  despawn(entity: Entity.T) {
    Entities.check(this.#entity_registry, entity)
    Stage.insert(this.#stage, this.#tick, Op.despawn(entity))
  }

  /**
   * Add one or more components to an entity.
   *
   * @example
   * <caption>Add a tag to an entity.</caption>
   * ```ts
   * let Consumable = tag()
   * let entity = world.spawn()
   * world.add(entity, Consumable)
   * world.step()
   * world.has(entity, Consumable) // true
   * ```
   * @example
   * <caption>Add a value to an entity.</caption>
   * ```ts
   * let Position = ref()
   * let entity = world.spawn()
   * world.add(entity, Position, {x: 0, y: 0})
   * ```
   * @example
   * <caption>Add a relationship to an entity.</caption>
   * ```ts
   * let Orbits = rel()
   * let star = world.spawn()
   * let planet = world.spawn()
   * world.add(planet, Orbits, star)
   * ```
   */
  add<U extends Component.T[]>(
    entity: Entity.T,
    type: Type.Type<U>,
    ...values: Op.Init<U>
  ) {
    Entities.check(this.#entity_registry, entity)
    Stage.insert(
      this.#stage,
      this.#tick,
      Op.add(type, entity, Op.init(type, values)),
    )
  }

  /**
   * Remove one or more components from an entity.
   *
   * @example
   * <caption>Remove a tag from an entity.</caption>
   * ```ts
   * let Consumable = tag()
   * let entity = world.spawn(Consumable)
   * world.remove(entity, Consumable)
   * world.step()
   * world.has(entity, Consumable) // false
   * ```
   * @example
   * <caption>Remove a value from an entity.</caption>
   * ```ts
   * let Position = ref()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.remove(entity, Position)
   * ```
   */
  remove<U extends Component.TBase[]>(entity: Entity.T, type: Type.T<U>): void
  /**
   * Remove one or more components from an entity, including relationships.
   *
   * @example
   * <caption>Remove a relationship from an entity.</caption>
   * ```ts
   * let Orbits = rel()
   * let star = world.spawn()
   * let planet = world.spawn(Orbits, star)
   * world.remove(planet, Orbits, star)
   * ```
   */
  remove<U extends Component.T[]>(entity: Entity.T, type: Type.T<U>): void
  remove(entity: Entity.T, type: Type.T) {
    Entities.check(this.#entity_registry, entity)
    Stage.insert(this.#stage, this.#tick, Op.remove(type, entity))
  }

  /**
   * Change the value of a component for a given entity.
   *
   * This method also increments the entity's version at the component, which
   * triggers `Changed` filters in queries.
   *
   * @example
   * <caption>Change the value of a component.</caption>
   * ```ts
   * let Position = ref()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.change(entity, Position, {x: 1, y: 1})
   * world.get(entity, Position) // {x: 1, y: 1}
   * ```
   * @example
   * <caption>Trigger changed filters in queries.</caption>
   * ```ts
   * let system_a: System = world => {
   *   let changed = query(world, type(Position), changed(Position))
   *   return () => {
   *     changed.each((entity, position) => {
   *      console.log("entity position changed", entity, position)
   *     })
   *   }
   * }
   * let system_b: System = world => {
   *   let kinetic = query(world, type(Position, Velocity))
   *   return () => {
   *    kinetic.each((entity, position, velocity) => {
   *     position.x += velocity.x
   *     position.y += velocity.y
   *     world.change(entity, Position, position)
   *   })
   * }
   * ```
   */
  change<U extends Component.TRef>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    init: Op.InitSingle<U>,
  ) {
    this.#locate(entity)
    let component = Type.component_at(type, 0)
    if (Component.is_ref_relation(component)) {
      let value = init as Op.InitRefPair<
        U extends Component.RefRelation<infer V> ? V : never
      >
      this.#write_pair(entity, component, value[0], value[1])
    } else {
      this.#write(entity, component, init)
    }
  }

  /**
   * Check if an entity has a given component. Returns `true` if the entity has
   * the component, `false` otherwise.
   *
   * @example
   * <caption>Check if an entity has a component.</caption>
   * ```ts
   * let Position = ref()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.step()
   * world.has(entity, Position) // true
   * world.has(entity, Velocity) // false
   * ```
   */
  has(entity: Entity.T, type: Type.T): boolean {
    let node = this.#locate(entity)
    return Type.has(node.type, type)
  }

  /**
   * Get the value of a component for a given entity.
   * @example
   * <caption>Get the value of a component.</caption>
   * ```ts
   * let Position = ref()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.step()
   * world.get(entity, Position) // {x: 0, y: 0}
   * ```
   */
  get<U extends Component.Ref>(
    entity: Entity.T,
    type: Type.Unitary<U>,
  ): Op.InitSingle<U>
  /**
   * Get the value of a relationship component for a given entity.
   * @example
   * <caption>Get the value of a relationship component.</caption>
   * ```ts
   * let Orbits = ref_rel()
   * let star = world.spawn()
   * let planet = world.spawn(Orbits, [star, {distance: 1, period: 1}])
   * world.step()
   * world.get(planet, Orbits, star) // {distance: 1, period: 1}
   * ```
   */
  get<U extends Component.RefRelation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    relative: Entity.T,
  ): Op.InitSingle<U>
  get(
    entity: Entity.T,
    type: Type.Unitary,
    relative?: Entity.T,
  ): Op.InitSingle {
    this.#locate(entity)
    let component = Type.component_at(type, 0)
    if (Component.is_relation(component)) {
      let pair = Entity.make(Assert.exists(relative), component.id)
      return this.store(pair)[entity]
    }
    return this.#read(entity, component)
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

  /**
   * Step the world forward to the specified tick. If no tick is specified, the
   * world will step forward by one tick.
   */
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
      Node.traverse_right(node, this.#despawn_disposed_node_entities)
    }
    // Relocate entities.
    Transaction.drain(
      this.#transaction,
      function move_entity_batch(batch, prev_node, next_node) {
        SparseSet.each(batch, function moveEntity(entity) {
          if (prev_node) Node.remove_entity(prev_node, entity)
          if (next_node) Node.insert_entity(next_node, entity)
        })
      },
    )
    // Drop all nodes marked for deletion.
    let node: Node.T | undefined
    while ((node = this.#nodes_to_prune.pop())) {
      Graph.prune(this.graph, node)
    }
  }

  get_exclusive_relative<U extends Component.TRelation>(
    entity: Entity.T,
    rel: Type.Unitary<U>,
  ) {
    let node = this.#locate(entity)
    let rel_component = rel.vec[0] as Component.TRelation
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
    let node = Graph.resolve_node_by_component(
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

  with<U extends Component.T[]>(type: Type.T<U>, ...values: Op.Init<U>) {
    return EntityBuilder.make(this, type, values)
  }

  for_each<U extends Component.T[]>(
    query: Query.T<U>,
    ...args: Query.EachArgs<U>
  ) {
    let compiled_query = this.#queries.get(query)
    if (compiled_query === undefined) {
      compiled_query = Query.compile(this, query)
      this.#queries.set(query, compiled_query)
    }
    compiled_query.for_each.apply(compiled_query, args as any)
  }
}
export type T = World

export let make = (tick = 0): World => {
  return new World(tick)
}
