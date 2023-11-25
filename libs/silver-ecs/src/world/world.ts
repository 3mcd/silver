import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import {EntityBuilder} from "../entity/entity_builder"
import * as Entities from "../entity/entities"
import * as Signal from "../signal"
import * as SparseSet from "../sparse/sparse_set"
import * as Stage from "../stage"
import * as Changes from "./changes"
import * as Commands from "./commands"
import * as Graph from "./graph"
import * as Transition from "./transition"

export class World {
  #entities
  #entityRelationshipRoots
  #nodesToDelete
  #stage
  #tick
  #transition

  readonly graph
  readonly stores
  readonly changes

  constructor(tick = 0) {
    this.#entities = Entities.make()
    this.#entityRelationshipRoots = [] as Graph.Node[][]
    this.#nodesToDelete = [] as Graph.Node[]
    this.#stage = Stage.make<Commands.T>()
    this.#tick = tick
    this.#transition = Transition.make()
    this.changes = Changes.make()
    this.graph = Graph.make()
    this.stores = [] as unknown[][]
    Signal.subscribe(this.graph.root.$created, this.#recordRelationNode)
  }

  locate(entity: Entity.T) {
    let node = Transition.locate(this.#transition, entity)
    Assert.ok(node !== undefined)
    return node
  }

  /**
   * Increment the version of a component for a given entity.
   */
  #bump(entity: Entity.T, component: Component.T) {
    Changes.bump(this.changes, entity, component.id)
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
    init: Commands.InitSingle<U>,
  ) {
    this.store(component.id)[entity] = init
    this.#bump(entity, component)
  }

  /**
   * Update an entity's component values.
   */
  #writeMany(entity: Entity.T, type: Type.T, init: unknown[]) {
    let initIndex = 0
    for (let i = 0; i < type.componentSpec.length; i++) {
      let component = type.componentSpec[i]
      if (Component.isValueRelation(component)) {
        // Relation components are initialized with a tuple of [entity, value].
        // Iterate each pair and write the value into the relationship's
        // component array.
        let value = init[initIndex] as Commands.InitValueRelation
        this.#writeRelationship(entity, component, value[0], value[1])
        initIndex++
      } else if (Component.isTagRelation(component)) {
        // Skip over tag relations because their entity is stored solely in
        // the relationship id.
        initIndex++
      } else if (Component.isValue(component)) {
        let value = init[initIndex]
        this.#write(entity, component, value)
        initIndex++
      }
    }
  }

  /**
   * Clear an entity's component values for a given type.
   */
  #clearMany(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.components.length; i++) {
      let component = type.components[i]
      if (Component.storesValue(component)) {
        this.#write(entity, component, undefined)
      }
    }
  }

  /**
   * Update the data of a value relationship for a given entity.
   */
  #writeRelationship<U extends Component.ValueRelation>(
    entity: Entity.T,
    component: U,
    relative: Entity.T,
    value: unknown,
  ) {
    // Compute the virtual component id for the relationship. This id is unique
    // to the relationship between the component and the relative. All entities
    // associated to the relative through this component will store their
    // values in the same component array.
    let relationshipComponentId = Entity.make(
      Entity.parseLo(relative),
      component.id,
    )
    this.store(relationshipComponentId)[entity] = value
    this.#bump(entity, component)
  }

  /**
   * Insert a new entity into the entity graph and write initial component
   * values.
   */
  #applySpawn(command: Commands.Spawn) {
    let {entity, type, init} = command
    let node = Graph.resolve(this.graph, type)
    // Insert the entity into the graph, write initial component values and
    // and remember its new node.
    Graph.insertEntity(node, entity)
    Transition.move(this.#transition, entity, node)
    this.#writeMany(entity, type, init)
  }

  /**
   * Remove an entity from the entity graph and clear all component values and
   * relationships.
   */
  #applyDespawn(command: Commands.Despawn) {
    this.#despawn(command.entity)
  }

  #despawn(entity: Entity.T) {
    let node = this.locate(entity)
    // Release all component values.
    this.#clearMany(entity, node.type)
    // Release all relationship nodes associated with this entity and move the
    // previously related entities to the left in the graph.
    this.#clearEntityRelationships(entity)
    // Remove the entity from the graph, forget its node, release the entity id
    // and record the move for monitor queries.
    Graph.removeEntity(node, entity)
    Entities.release(this.#entities, entity)
    Transition.move(this.#transition, entity)
  }

  /**
   * Add or update a component for an entity.
   */
  #applyAdd(command: Commands.Add) {
    let {entity, type, init} = command
    let prevNode = this.locate(entity)
    let nextType = Type.with(prevNode.type, type)
    let nextNode = Graph.resolve(this.graph, nextType)
    // If the entity does not have one or more of the components in the added
    // type, move the entity to its new node.
    Transition.move(this.#transition, entity, nextNode)
    // Store added and updated component values.
    this.#writeMany(entity, type, init)
  }

  /**
   * Remove components from an entity.
   */
  #applyRemove(command: Commands.Remove) {
    let {entity, type} = command
    let prevNode = this.locate(entity)
    let nextType = Type.without(prevNode.type, type)
    let nextNode = Graph.resolve(this.graph, nextType)
    // Move the entity to its new node (to the left) and release removed
    // component values.
    Transition.move(this.#transition, entity, nextNode)
    this.#clearMany(entity, type)
  }

  /**
   * Marshal relationship nodes into a map indexed by the relationship's entity
   * id. This map is used to dispose an entity's relationship nodes when the
   * entity is despawned.
   */
  #recordRelationNode = (node: Graph.Node) => {
    for (let i = 0; i < node.type.relationships.length; i++) {
      let relationship = node.type.relationships[i]
      let relationshipEntityId = Entity.parseLo(relationship.id)
      let relationshipEntity = Entities.hydrate(
        this.#entities,
        relationshipEntityId,
      )
      // Get or create the list of relationship nodes for the relationship
      // entity.
      let entityRelationshipRoots = (this.#entityRelationshipRoots[
        relationshipEntity
      ] ??= [])
      // Get or create the root relationship node and insert it into the
      // entity's list of relationship nodes.
      // TODO: This results in duplicate nodes in the array when more specific
      // nodes are created to the right of already-tracked nodes.
      entityRelationshipRoots.push(
        Graph.resolve(this.graph, Type.make(relationship)),
      )
    }
  }

  /**
   * Remove all relationship nodes associated with an entity and move related
   * entities to the left in the graph.
   */
  #clearEntityRelationships(entity: Entity.T) {
    // Look up nodes that lead to the entity's relatives.
    let entityRelationshipRoots = this.#entityRelationshipRoots[entity]
    if (entityRelationshipRoots === undefined) {
      return
    }
    for (let i = 0; i < entityRelationshipRoots.length; i++) {
      let relationshipRoot = entityRelationshipRoots[i]
      let relationshipRelation = Type.componentAt(
        relationshipRoot.type,
        0,
      ) as Component.TRelationship
      let relationshipStore = this.store(relationshipRelation.id)
      let relationId = Entity.parseHi(relationshipRelation.id)
      let relation = Assert.exists(Component.getRelation(relationId))
      // If the relationship is inclusive (i.e. not hierarchical), remove the
      // relationship from all related entities.
      if (relation.topology === Component.Topology.Inclusive) {
        Graph.moveEntitiesLeft(
          this.graph,
          relationshipRoot,
          relationshipRelation,
          (entity, node) => {
            Transition.move(this.#transition, entity, node)
            relationshipStore[entity] = undefined!
          },
        )
      }
      // Delete the root relationship node, which will also delete all
      // relationship nodes that lead to the entity's relatives.
      this.#nodesToDelete.push(relationshipRoot)
    }
    this.#entityRelationshipRoots[entity] = undefined!
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
   * let InContainer = ecs.relation(ecs.Topology.Exclusive)
   * let Item = ecs.type(InContainer)
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
   * let Position = ecs.value()
   * let Velocity = ecs.value()
   * let entity = world.spawn(ecs.type(Position, Velocity), {x: 0, y: 0}, {x: 1, y: 1})
   * ```
   * @example
   * <caption>Create an entity with a rotation and a spectating relationship.</caption>
   * ```ts
   * let Spectating = ecs.relation()
   * let Spectator = ecs.type(Rotation, Spectating)
   * let entity = world.spawn(Spectator, [Quaternion.from(playerRotation), player])
   * ```
   */
  spawn<U extends Component.T[]>(
    type: Type.Type<U>,
    ...values: Commands.Init<U>
  ): Entity.T
  spawn(type?: Type.T, ...values: Commands.Init): Entity.T {
    let entity = Entities.retain(this.#entities)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.spawn(
        type ? Type.withRelationships(type, values) : Type.make(),
        entity,
        values,
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
   * let Orbits = ecs.relation()
   * let DockedTo = ecs.relation(ecs.Topology.Exclusive)
   * let planet = world.spawn()
   * let station = world.spawn(Orbits, planet)
   * let spaceship = world.spawn(DockedTo, station)
   * world.despawn(planet) // despawns only `planet`
   * world.despawn(station) // despawns both `station` and `spaceship`
   * ```
   */
  despawn(entity: Entity.T) {
    Entities.check(this.#entities, entity)
    Stage.insert(this.#stage, this.#tick, Commands.despawn(entity))
  }

  /**
   * Add one or more components to an entity.
   *
   * @example
   * <caption>Add a tag to an entity.</caption>
   * ```ts
   * let Consumable = ecs.tag()
   * let entity = world.spawn()
   * world.add(entity, Consumable)
   * world.step()
   * world.has(entity, Consumable) // true
   * ```
   * @example
   * <caption>Add a value to an entity.</caption>
   * ```ts
   * let Position = ecs.value()
   * let entity = world.spawn()
   * world.add(entity, Position, {x: 0, y: 0})
   * ```
   * @example
   * <caption>Add a relationship to an entity.</caption>
   * ```ts
   * let Orbits = ecs.relation()
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
    Entities.check(this.#entities, entity)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.add(
        Type.hasRelations(type)
          ? (Type.withRelationships(type, values) as Type.T<U>)
          : type,
        entity,
        values,
      ),
    )
  }

  /**
   * Remove one or more components from an entity.
   *
   * @example
   * <caption>Remove a tag from an entity.</caption>
   * ```ts
   * let Consumable = ecs.tag()
   * let entity = world.spawn(Consumable)
   * world.remove(entity, Consumable)
   * world.step()
   * world.has(entity, Consumable) // false
   * ```
   * @example
   * <caption>Remove a value from an entity.</caption>
   * ```ts
   * let Position = ecs.value()
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
   * let Orbits = ecs.relation()
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
  remove(entity: Entity.T, type: Type.T, relatives?: Entity.T[]) {
    Entities.check(this.#entities, entity)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.remove(
        Type.hasRelations(type)
          ? Type.withRelationships(type, relatives!)
          : type,
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
   * let Position = ecs.value()
   * let entity = world.spawn(Position, {x: 0, y: 0})
   * world.change(entity, Position, {x: 1, y: 1})
   * world.get(entity, Position) // {x: 1, y: 1}
   * ```
   * @example
   * <caption>Trigger changed filters in queries.</caption>
   * ```ts
   * let systemA: ecs.System = world => {
   *   let changed = ecs.query(world, ecs.type(Position), ecs.Changed(Position))
   *   return () => {
   *     changed.each((entity, position) => {
   *      console.log("entity position changed", entity, position)
   *     })
   *   }
   * }
   * let systemB: ecs.System = world => {
   *   let kinetic = ecs.query(world, ecs.type(Position, Velocity))
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
      let value = init as Commands.InitValueRelation<
        U extends Component.ValueRelation<infer V> ? V : never
      >
      this.#writeRelationship(entity, component, value[0], value[1])
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
   * let Position = ecs.value()
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
   * let Orbits = ecs.relation()
   * let star = world.spawn()
   * let planet = world.spawn(Orbits, star)
   * world.step()
   * world.has(planet, Orbits, star) // true
   * ```
   */
  has<U extends Component.ValueRelation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    relative: Entity.T,
  ): boolean
  has(entity: Entity.T, type: Type.Unitary, relative?: Entity.T): boolean {
    let node = this.locate(entity)
    let component = Type.componentAt(type, 0)
    if (Component.isRelation(component)) {
      let relationship = Entity.make(Assert.exists(relative), component.id)
      return Type.hasId(node.type, relationship)
    }
    return Type.has(node.type, type)
  }

  /**
   * Get the value of a component for a given entity.
   * @example
   * <caption>Get the value of a component.</caption>
   * ```ts
   * let Position = ecs.value()
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
   * let Orbits = ecs.valueRelation()
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
      let relationship = Entity.make(Assert.exists(relative), component.id)
      return this.store(relationship)[entity]
    }
    return this.#read(entity, component)
  }

  /**
   * Check if an entity matches a given type. Returns `true` if the entity
   * has every component in the type, `false` otherwise.
   * @example
   * <caption>Check if an entity matches a type.</caption>
   * ```ts
   * let Position = ecs.value()
   * let Velocity = ecs.value()
   * let entity = world.spawn(ecs.type(Position, Velocity), {x: 0, y: 0}, {x: 1, y: 1})
   * world.step()
   * world.matches(entity, ecs.type(Position, Velocity)) // true
   * ```
   * @example
   * <caption>Check if an entity matches a type with relationships.</caption>
   * ```ts
   * let Spectating = ecs.relation()
   * let Spectator = ecs.type(Rotation, Spectating)
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
      Type.hasRelations(type) ? Type.withRelationships(type, relatives) : type,
    )
  }

  /**
   * Step the world forward to the specified tick. If no tick is specified, the
   * world will step forward by one tick.
   */
  step(tick: number = this.#tick + 1) {
    // Execute all commands in the stage up to the given tick.
    while (this.#tick < tick) {
      Stage.drainTo(this.#stage, tick, this.#applyCommand)
      this.#tick++
    }
    // Immediately despawn all entities whose nodes are marked for deletion.
    for (let i = 0; i < this.#nodesToDelete.length; i++) {
      let node = this.#nodesToDelete[i]
      Graph.traverse(node, node => {
        SparseSet.each(node.entities, entity => {
          this.#despawn(entity)
        })
      })
    }
    // Handle all entity transitions.
    Transition.drain(
      this.#transition,
      this.graph,
      (batch, prevNode, nextNode) => {
        SparseSet.each(batch, entity => {
          if (prevNode) Graph.removeEntity(prevNode, entity)
          if (nextNode) Graph.insertEntity(nextNode, entity)
        })
      },
    )
    // Drop all nodes marked for deletion.
    let node: Graph.Node
    while ((node = this.#nodesToDelete.pop()!)) {
      Graph.deleteNode(this.graph, node)
    }
  }

  getExclusiveRelative<U extends Component.TRelation>(
    entity: Entity.T,
    relation: Type.Unitary<U>,
  ) {
    let node = this.locate(entity)
    let component = relation.components[0] as Component.TRelation
    if (component.topology !== Component.Topology.Exclusive) {
      throw new Error("Expected exclusive relation")
    }
    if (!Type.has(node.type, relation)) {
      throw new Error("Expected entity to have relation")
    }
    for (let i = 0; i < node.type.relationships.length; i++) {
      let relationship = node.type.relationships[i]
      let relationshipComponentId = Entity.parseHi(relationship.id)
      if (relationshipComponentId === component.id) {
        return Entities.hydrate(this.#entities, Entity.parseLo(relationship.id))
      }
    }
    throw new Error("Unexpected")
  }

  isAlive(entity: Entity.T) {
    try {
      Entities.check(this.#entities, entity)
      return true
    } catch {
      return false
    }
  }

  hydrate(entityId: number) {
    return Entities.hydrate(this.#entities, entityId)
  }

  store(componentId: number) {
    return (this.stores[componentId] ??= [])
  }

  with<U extends Component.T[]>(type: Type.T<U>, ...init: Commands.Init<U>) {
    return new EntityBuilder(this, type, ...init)
  }
}
export type T = World

export let makeWorld = (tick = 0): World => new World(tick)
