import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as EntityBuilder from "../entity/entity_builder"
import * as Entities from "../entity/entity_registry"
import * as Signal from "../signal"
import * as SparseSet from "../sparse/sparse_set"
import * as SparseMap from "../sparse/sparse_map"
import * as Stage from "../stage"
import * as EntityVersions from "../entity/entity_versions"
import * as Commands from "./commands"
import * as Graph from "./graph"
import * as Transaction from "./transaction"

export class World {
  #entityRegistry
  #entityPairRoots
  #nodesToPrune
  #releaseTemp
  #releaseTempAt
  #stage
  #tick
  #transaction

  readonly entityChanges
  readonly graph
  readonly stores
  readonly temp

  constructor(tick = 0) {
    this.#entityRegistry = Entities.make()
    this.#entityPairRoots = [] as Graph.Node[][]
    this.#nodesToPrune = [] as Graph.Node[]
    this.#stage = Stage.make<Commands.T>()
    this.#tick = tick
    this.#transaction = Transaction.make()
    this.#releaseTemp = false
    this.#releaseTempAt = undefined as number | undefined
    this.entityChanges = EntityVersions.make()
    this.graph = Graph.make()
    this.stores = [] as unknown[][]
    this.temp = SparseMap.make<SparseMap.T>()
    Signal.subscribe(this.graph.root.$created, this.#recordRelationNode)
  }

  locate(entity: Entity.T) {
    let node = Transaction.locateNextEntityNode(this.#transaction, entity)
    Assert.ok(node !== undefined)
    return node
  }

  /**
   * Increment the version of a component for a given entity.
   */
  #bump(entity: Entity.T, component: Component.T) {
    EntityVersions.bump(this.entityChanges, entity, component.id)
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
    value: Commands.InitSingle<U>,
  ) {
    this.store(component.id)[entity] = value
    this.#bump(entity, component)
  }

  /**
   * Update the data of a value pair for a given entity.
   */
  #writePair<U extends Component.ValueRelation>(
    entity: Entity.T,
    component: U,
    relative: Entity.T,
    value: unknown,
  ) {
    // Compute the virtual component id for the pair. This id is unique to the
    // pair between the component and the relative. All entities associated to
    // with the relative through this component will store their values in the
    // same component array.
    let pairId = Entity.make(Entity.parseLo(relative), component.id)
    this.store(pairId)[entity] = value
    this.#bump(entity, component)
  }

  #writeTemp<U extends Component.T>(
    entity: Entity.T,
    component: U,
    value: Commands.InitSingle<U>,
  ) {
    let store = SparseMap.get(this.temp, component.id)
    if (store === undefined) {
      store = SparseMap.make()
      SparseMap.set(this.temp, component.id, store)
    }
    SparseMap.set(store, entity, value)
    this.#releaseTemp = true
  }

  /**
   * Update an entity's component values.
   */
  #writeMany(entity: Entity.T, type: Type.T, values: unknown[]) {
    let j = 0
    for (let i = 0; i < type.components.length; i++) {
      let component = type.components[i]
      if (Component.isValueRelation(component)) {
        // Relation components are initialized with a tuple of [entity, value].
        // Iterate each pair and write the value into the pair's component
        // array.
        let value = values[j] as Commands.InitValuePair
        this.#writePair(entity, component, value[0], value[1])
        j++
      } else if (Component.isTagRelation(component)) {
        // Skip over tag relations because their entity is stored solely in the
        // pair id.
        j++
      } else if (Component.isValue(component)) {
        let value = values[j]
        this.#write(entity, component, value)
        j++
      }
    }
  }

  #clear(entity: Entity.T, component: Component.T) {
    this.#writeTemp(entity, component, this.#read(entity, component))
    this.#write(entity, component, undefined)
  }

  /**
   * Clear an entity's component values for a given type.
   */
  #clearMany(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.ordered.length; i++) {
      let component = type.ordered[i]
      if (Component.storesValue(component)) {
        this.#clear(entity, component)
      }
    }
  }

  /**
   * Insert a new entity into the entity graph and write initial component
   * values.
   */
  #applySpawn(command: Commands.Spawn) {
    let {entity, type, init} = command
    let node = Graph.resolve(this.graph, type)
    this.#writeMany(entity, type, init)
    Transaction.move(this.#transaction, entity, node)
  }

  /**
   * Remove an entity from the entity graph and clear all component values and
   * pairs.
   */
  #applyDespawn(command: Commands.Despawn) {
    this.#despawn(command.entity)
  }

  #despawn = (entity: Entity.T) => {
    let node = this.locate(entity)
    this.#clearMany(entity, node.type)
    this.#clearEntityPairs(entity)
    Entities.release(this.#entityRegistry, entity)
    Transaction.move(this.#transaction, entity)
  }

  #despawnDroppedNodeEntities = (node: Graph.Node) => {
    SparseSet.each(node.entities, this.#despawn)
  }

  /**
   * Add or update a component for an entity.
   */
  #applyAdd(command: Commands.Add) {
    let {entity, type, init} = command
    let prevNode = this.locate(entity)
    let nextType = Type.with(prevNode.type, type)
    let nextNode = Graph.resolve(this.graph, nextType)
    this.#writeMany(entity, type, init)
    Transaction.move(this.#transaction, entity, nextNode)
  }

  /**
   * Remove components from an entity.
   */
  #applyRemove(command: Commands.Remove) {
    let {entity, type} = command
    let prevNode = this.locate(entity)
    let nextType = Type.without(prevNode.type, type)
    let nextNode = Graph.resolve(this.graph, nextType)
    this.#clearMany(entity, type)
    Transaction.move(this.#transaction, entity, nextNode)
  }

  /**
   * Marshal pair nodes into a map indexed by the pair's entity id. This map is
   * used to dispose an entity's pair nodes when the entity is despawned.
   */
  #recordRelationNode = (node: Graph.Node) => {
    for (let i = 0; i < node.type.pairs.length; i++) {
      let pair = node.type.pairs[i]
      let pairEntityId = Entity.parseLo(pair.id)
      let pairEntity = Entities.hydrate(this.#entityRegistry, pairEntityId)
      // Get or create the root pair node and insert it into the entity's list
      // of pair nodes.
      let pairRoots = (this.#entityPairRoots[pairEntity] ??= [])
      let pairRoot = Graph.resolveByComponent(this.graph, pair)
      // TODO: Use a Set or something faster than Array.prototype.includes.
      if (!pairRoots.includes(pairRoot)) {
        pairRoots.push(pairRoot)
      }
    }
  }

  /**
   * Remove all pair nodes associated with an entity and move related entities
   * to the left in the graph.
   */
  #clearEntityPairs(entity: Entity.T) {
    // Look up nodes that lead to the entity's relatives.
    let entityPairRoots = this.#entityPairRoots[entity]
    if (entityPairRoots === undefined) {
      return
    }
    for (let i = 0; i < entityPairRoots.length; i++) {
      let pairRoot = entityPairRoots[i]
      let pair = Type.componentAt(pairRoot.type, 0) as Component.TPair
      let pairComponentId = Entity.parseHi(pair.id)
      let pairComponent = Assert.exists(Component.findById(pairComponentId))
      // If the pair is inclusive (i.e. not hierarchical), remove the pair from
      // all related entities.
      if (
        (pairComponent as Component.TRelation).topology ===
        Component.Topology.Inclusive
      ) {
        Graph.moveEntitiesLeft(this.graph, pairRoot, pair, (entity, node) => {
          Transaction.move(this.#transaction, entity, node)
          this.#write(entity, pair, undefined)
        })
      }
      // Delete the root pair node, which will also delete all pair nodes that
      // lead to the entity's relatives.
      this.#nodesToPrune.push(pairRoot)
    }
    this.#entityPairRoots[entity] = undefined!
  }

  /**
   * Apply a single command.
   */
  #applyCommand = (command: Commands.T) => {
    switch (command.kind) {
      case "spawn":
        this.#applySpawn(command)
        break
      case "despawn":
        this.#applyDespawn(command)
        break
      case "add":
        this.#applyAdd(command)
        break
      case "remove":
        this.#applyRemove(command)
        break
    }
  }

  /**
   * Get the current tick (i.e. logical timestamp or frame).
   */
  get tick() {
    return this.#tick
  }

  /**
   * Create an entity with no components.
   *
   * @example
   * <caption>Create an container entity.</caption>
   * ```ts
   * let InContainer = S.relation(S.Topology.Exclusive)
   * let Item = S.type(InContainer)
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
   * let Position = S.value()
   * let Velocity = S.value()
   * let entity = world.spawn(S.type(Position, Velocity), {x: 0, y: 0}, {x: 1, y: 1})
   * ```
   * @example
   * <caption>Create an entity with a rotation and a spectating relationship.</caption>
   * ```ts
   * let Spectating = S.relation()
   * let Spectator = S.type(Rotation, Spectating)
   * let entity = world.spawn(Spectator, [Quaternion.from(playerRotation), player])
   * ```
   */
  spawn<U extends Component.T[]>(
    type: Type.Type<U>,
    ...values: Commands.Init<U>
  ): Entity.T
  spawn(type?: Type.T, ...values: Commands.Init): Entity.T {
    let entity = Entities.retain(this.#entityRegistry)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.spawn(
        type ? Type.pair(type, values) : Type.make(),
        entity,
        type ? Commands.init(type, values) : values,
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
   * let Orbits = S.relation()
   * let DockedTo = S.relation(S.Topology.Exclusive)
   * let planet = world.spawn()
   * let station = world.spawn(Orbits, planet)
   * let spaceship = world.spawn(DockedTo, station)
   * world.despawn(planet) // despawns only `planet`
   * world.despawn(station) // despawns both `station` and `spaceship`
   * ```
   */
  despawn(entity: Entity.T) {
    Entities.check(this.#entityRegistry, entity)
    Stage.insert(this.#stage, this.#tick, Commands.despawn(entity))
  }

  /**
   * Add one or more components to an entity.
   *
   * @example
   * <caption>Add a tag to an entity.</caption>
   * ```ts
   * let Consumable = S.tag()
   * let entity = world.spawn()
   * world.add(entity, Consumable)
   * world.step()
   * world.has(entity, Consumable) // true
   * ```
   * @example
   * <caption>Add a value to an entity.</caption>
   * ```ts
   * let Position = S.value()
   * let entity = world.spawn()
   * world.add(entity, Position, {x: 0, y: 0})
   * ```
   * @example
   * <caption>Add a relationship to an entity.</caption>
   * ```ts
   * let Orbits = S.relation()
   * let star = world.spawn()
   * let planet = world.spawn()
   * world.add(planet, Orbits, star)
   * ```
   */
  add<U extends Component.T[]>(
    entity: Entity.T,
    type: Type.Type<U>,
    ...values: Commands.Init<U>
  ) {
    Entities.check(this.#entityRegistry, entity)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.add(
        type.kind === Type.Kind.Unpaired
          ? (Type.pair(type, values) as Type.T<U>)
          : type,
        entity,
        Commands.init(type, values),
      ),
    )
  }

  /**
   * Remove one or more components from an entity.
   *
   * @example
   * <caption>Remove a tag from an entity.</caption>
   * ```ts
   * let Consumable = S.tag()
   * let entity = world.spawn(Consumable)
   * world.remove(entity, Consumable)
   * world.step()
   * world.has(entity, Consumable) // false
   * ```
   * @example
   * <caption>Remove a value from an entity.</caption>
   * ```ts
   * let Position = S.value()
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
   * let Orbits = S.relation()
   * let star = world.spawn()
   * let planet = world.spawn(Orbits, star)
   * world.remove(planet, Orbits, star)
   * ```
   */
  remove<U extends Component.T[]>(
    entity: Entity.T,
    type: Type.T<U>,
    ...relatives: Component.Relatives<U>
  ): void
  remove(entity: Entity.T, type: Type.T, ...relatives: Entity.T[]) {
    Entities.check(this.#entityRegistry, entity)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.remove(
        type.kind === Type.Kind.Unpaired ? Type.pair(type, relatives!) : type,
        entity,
      ),
    )
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
   * let Position = S.value()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.change(entity, Position, {x: 1, y: 1})
   * world.get(entity, Position) // {x: 1, y: 1}
   * ```
   * @example
   * <caption>Trigger changed filters in queries.</caption>
   * ```ts
   * let systemA: S.System = world => {
   *   let changed = S.query(world, S.type(Position), S.Changed(Position))
   *   return () => {
   *     changed.each((entity, position) => {
   *      console.log("entity position changed", entity, position)
   *     })
   *   }
   * }
   * let systemB: S.System = world => {
   *   let kinetic = S.query(world, S.type(Position, Velocity))
   *   return () => {
   *    kinetic.each((entity, position, velocity) => {
   *     position.x += velocity.x
   *     position.y += velocity.y
   *     world.change(entity, Position, position)
   *   })
   * }
   * ```
   */
  change<U extends Component.TValue>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    init: Commands.InitSingle<U>,
  ) {
    this.locate(entity)
    let component = Type.componentAt(type, 0)
    if (Component.isValueRelation(component)) {
      let value = init as Commands.InitValuePair<
        U extends Component.ValueRelation<infer V> ? V : never
      >
      this.#writePair(entity, component, value[0], value[1])
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
   * let Position = S.value()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.step()
   * world.has(entity, Position) // true
   * world.has(entity, Velocity) // false
   * ```
   */
  has<U extends Component.TBase>(
    entity: Entity.T,
    type: Type.Unitary<U>,
  ): boolean
  /**
   * Check if an entity is related to another entity through a given relation.
   * Returns `true` if the entity is related to the other entity, `false`
   * otherwise.
   *
   * @example
   * <caption>Check if an entity is related to another entity.</caption>
   * ```ts
   * let Orbits = S.relation()
   * let star = world.spawn()
   * let planet = world.spawn(Orbits, star)
   * world.step()
   * world.has(planet, Orbits, star) // true
   * ```
   */
  has<U extends Component.TRelation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    relative: Entity.T,
  ): boolean
  has(entity: Entity.T, type: Type.Unitary, relative?: Entity.T): boolean {
    let node = this.locate(entity)
    let component = Type.componentAt(type, 0)
    if (Component.isRelation(component)) {
      let pair = Entity.make(Assert.exists(relative), component.id)
      return Type.hasId(node.type, pair)
    }
    return Type.has(node.type, type)
  }

  /**
   * Get the value of a component for a given entity.
   * @example
   * <caption>Get the value of a component.</caption>
   * ```ts
   * let Position = S.value()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.step()
   * world.get(entity, Position) // {x: 0, y: 0}
   * ```
   */
  get<U extends Component.Value>(
    entity: Entity.T,
    type: Type.Unitary<U>,
  ): Commands.InitSingle<U>
  /**
   * Get the value of a relationship component for a given entity.
   * @example
   * <caption>Get the value of a relationship component.</caption>
   * ```ts
   * let Orbits = S.valueRelation()
   * let star = world.spawn()
   * let planet = world.spawn(Orbits, [star, {distance: 1, period: 1}])
   * world.step()
   * world.get(planet, Orbits, star) // {distance: 1, period: 1}
   * ```
   */
  get<U extends Component.ValueRelation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    relative: Entity.T,
  ): Commands.InitSingle<U>
  get(
    entity: Entity.T,
    type: Type.Unitary,
    relative?: Entity.T,
  ): Commands.InitSingle {
    this.locate(entity)
    let component = Type.componentAt(type, 0)
    if (Component.isRelation(component)) {
      let pair = Entity.make(Assert.exists(relative), component.id)
      return this.store(pair)[entity]
    }
    return this.#read(entity, component)
  }

  /**
   * Check if an entity matches a given type. Returns `true` if the entity
   * has every component in the type, `false` otherwise.
   * @example
   * <caption>Check if an entity matches a type.</caption>
   * ```ts
   * let Position = S.value()
   * let Velocity = S.value()
   * let entity = world.spawn(S.type(Position, Velocity), {x: 0, y: 0}, {x: 1, y: 1})
   * world.step()
   * world.matches(entity, S.type(Position, Velocity)) // true
   * ```
   * @example
   * <caption>Check if an entity matches a type with relationships.</caption>
   * ```ts
   * let Spectating = S.relation()
   * let Spectator = S.type(Rotation, Spectating)
   * let entity = world.spawn(Spectator, [Quaternion.from(playerRotation), player])
   * world.step()
   * world.matches(entity, Spectator, player) // true
   * ```
   */
  matches<U extends Component.T[]>(
    entity: Entity.T,
    type: Type.Type<U>,
    ...relatives: Component.Relatives<U>
  ): boolean {
    let node = this.locate(entity)
    return Type.has(
      node.type,
      type.kind === Type.Kind.Unpaired ? Type.pair(type, relatives) : type,
    )
  }

  reset(tick: number) {
    this.#tick = tick
    this.#releaseTempAt = undefined
    this.#releaseTemp = false
    Stage.drainTo(this.#stage, tick)
    Transaction.drain(this.#transaction)
    SparseMap.each(this.temp, (_, map) => {
      SparseMap.clear(map)
    })
  }

  /**
   * Step the world forward to the specified tick. If no tick is specified, the
   * world will step forward by one tick.
   */
  step(tick: number = this.#tick + 1) {
    if (
      this.#releaseTempAt !== undefined &&
      this.#tick >= this.#releaseTempAt
    ) {
      SparseMap.each(this.temp, function releaseTempValues(_, map) {
        SparseMap.clear(map)
      })
      this.#releaseTempAt = undefined
    }
    // Execute all commands in the stage up to the given tick.
    while (this.#tick < tick) {
      Stage.drainTo(this.#stage, tick, this.#applyCommand)
      this.#tick++
    }
    if (this.#releaseTemp) {
      this.#releaseTempAt = this.#tick + 1
      this.#releaseTemp = false
    }
    // Immediately despawn all entities whose nodes are marked for deletion.
    for (let i = 0; i < this.#nodesToPrune.length; i++) {
      let node = this.#nodesToPrune[i]
      Graph.traverse(node, this.#despawnDroppedNodeEntities)
    }
    // Relocate entities.
    Transaction.drain(
      this.#transaction,
      function moveEntityBatch(batch, prevNode, nextNode) {
        SparseSet.each(batch, function moveEntity(entity) {
          if (prevNode) Graph.removeEntity(prevNode, entity)
          if (nextNode) Graph.insertEntity(nextNode, entity)
        })
      },
    )
    // Drop all nodes marked for deletion.
    let node: Graph.Node | undefined
    while ((node = this.#nodesToPrune.pop())) {
      Graph.pruneNode(this.graph, node)
    }
  }

  getExclusiveRelative<U extends Component.TRelation>(
    entity: Entity.T,
    relation: Type.Unitary<U>,
  ) {
    let node = this.locate(entity)
    let component = relation.ordered[0] as Component.TRelation
    if (component.topology !== Component.Topology.Exclusive) {
      throw new Error("Expected exclusive relation")
    }
    if (!Type.has(node.type, relation)) {
      return undefined
    }
    for (let i = 0; i < node.type.pairs.length; i++) {
      let pair = node.type.pairs[i]
      let pairId = Entity.parseHi(pair.id)
      if (pairId === component.id) {
        return Entities.hydrate(this.#entityRegistry, Entity.parseLo(pair.id))
      }
    }
    throw new Error("Unexpected")
  }

  isAlive(entity: Entity.T) {
    return Entities.checkFast(this.#entityRegistry, entity)
  }

  hydrate(entityId: number) {
    return Entities.hydrate(this.#entityRegistry, entityId)
  }

  store(componentId: number) {
    let store = (this.stores[componentId] ??= [])
    if (!SparseMap.has(this.temp, componentId)) {
      SparseMap.set(this.temp, componentId, SparseMap.make())
    }
    return store
  }

  with<U extends Component.T[]>(type: Type.T<U>, ...values: Commands.Init<U>) {
    return EntityBuilder.make(this, type, values)
  }
}
export type T = World

export let makeWorld = (tick = 0): World => {
  return new World(tick)
}
