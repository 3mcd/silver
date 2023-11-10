import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as EntityRegistry from "../entity/entity_registry"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as SparseSet from "../sparse/sparse_set"
import * as Stage from "../stage"
import * as Changes from "./changes"
import * as Commands from "./commands"
import * as Graph from "./graph"
import * as Transition from "./transition"

export class World {
  #entity_registry
  #entity_relationship_roots
  #nodes_by_entity
  #nodes_to_delete
  #stage
  #tick
  #transition

  readonly graph
  readonly stores
  readonly changes

  constructor(tick = 0) {
    this.#entity_registry = EntityRegistry.make()
    this.#entity_relationship_roots = [] as Graph.Node[][]
    this.#nodes_by_entity = SparseMap.make<Graph.Node>()
    this.#nodes_to_delete = [] as Graph.Node[]
    this.#stage = Stage.make<Commands.T>()
    this.#tick = tick
    this.#transition = Transition.make()
    this.changes = Changes.make()
    this.graph = Graph.make()
    this.stores = [] as unknown[][]
    Signal.subscribe(this.graph.root.$created, this.#record_relation_node)
  }

  #locate(entity: Entity.T) {
    let node = SparseMap.get(this.#nodes_by_entity, entity)
    Assert.ok(node !== undefined)
    return node
  }

  /**
   * Move an entity from its current node to a new node.
   */
  #move(entity: Entity.T, prev_node: Graph.Node, next_node: Graph.Node) {
    Graph.remove_entity(prev_node, entity)
    Graph.insert_entity(next_node, entity)
    SparseMap.set(this.#nodes_by_entity, entity, next_node)
    // Track the entity's transition from the previous node to the next node
    // for monitor queries.
    Transition.move(this.#transition, entity, prev_node, next_node)
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
  #write_many(entity: Entity.T, type: Type.T, init: unknown[]) {
    let init_index = 0
    for (let i = 0; i < type.component_spec.length; i++) {
      let component = type.component_spec[i]
      if (Component.is_value_relation(component)) {
        // Relation components are initialized with a tuple of [entity, value].
        // Iterate each pair and write the value into the relationship's
        // component array.
        let value = init[init_index] as Commands.InitValueRelation
        this.#write_relationship(entity, component, value[0], value[1])
        init_index++
      } else if (Component.is_tag_relation(component)) {
        // Skip over tag relations because their entity is stored solely in
        // the relationship id.
        init_index++
      } else if (Component.is_value(component)) {
        let value = init[init_index]
        this.#write(entity, component, value)
        init_index++
      }
    }
  }

  /**
   * Clear an entity's component values for a given type.
   */
  #clear_many(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.components.length; i++) {
      let component = type.components[i]
      if (Component.wraps_value(component)) {
        this.#write(entity, component, undefined)
      }
    }
  }

  /**
   * Update the data of a value relationship for a given entity.
   */
  #write_relationship<U extends Component.ValueRelation>(
    entity: Entity.T,
    component: U,
    relative: Entity.T,
    value: unknown,
  ) {
    // Compute the virtual component id for the relationship. This id is unique
    // to the relationship between the component and the relative. All entities
    // associated to the relative through this component will store their
    // values in the same component array.
    let relationship_component_id = Entity.make(
      Entity.parse_lo(relative),
      component.id,
    )
    this.store(relationship_component_id)[entity] = value
    this.#bump(entity, component)
  }

  /**
   * Insert a new entity into the entity graph and write initial component
   * values.
   */
  #apply_spawn(command: Commands.Spawn) {
    let {entity, type, init} = command
    let node = Graph.resolve(this.graph, type)
    // Insert the entity into the graph, write initial component values and
    // and remember its new node.
    Graph.insert_entity(node, entity)
    this.#write_many(entity, type, init)
    this.#move(entity, this.graph.root, node)
  }

  /**
   * Remove an entity from the entity graph and clear all component values and
   * relationships.
   */
  #apply_despawn(command: Commands.Despawn) {
    this.#despawn(command.entity)
  }

  #despawn(entity: Entity.T) {
    let node = this.#locate(entity)
    // Release all component values.
    this.#clear_many(entity, node.type)
    // Release all relationship nodes associated with this entity and move the
    // previously related entities to the left in the graph.
    this.#clear_entity_relationships(entity)
    // Remove the entity from the graph, forget its node, release the entity id
    // and record the move for monitor queries.
    Graph.remove_entity(node, entity)
    SparseMap.delete(this.#nodes_by_entity, entity)
    EntityRegistry.release(this.#entity_registry, entity)
    Transition.move(this.#transition, entity, node, this.graph.root)
  }

  /**
   * Add or update a component for an entity.
   */
  #apply_add(command: Commands.Add) {
    let {entity, type, init} = command
    let prev_node = this.#locate(entity)
    let next_type = Type.with(prev_node.type, type)
    let next_node = Graph.resolve(this.graph, next_type)
    // If the entity does not have one or more of the components in the added
    // type, move the entity to its new node.
    if (prev_node !== next_node) {
      this.#move(entity, prev_node, next_node)
      SparseMap.set(this.#nodes_by_entity, entity, next_node)
    }
    // Store added and updated component values.
    this.#write_many(entity, type, init)
  }

  /**
   * Remove components from an entity.
   */
  #apply_remove(command: Commands.Remove) {
    let {entity, type} = command
    let prev_node = this.#locate(entity)
    let next_type = Type.without(prev_node.type, type)
    let next_node = Graph.resolve(this.graph, next_type)
    // If the entity does not contain a component of the added type, do
    // nothing.
    if (prev_node === next_node) {
      return
    }
    // Move the entity to its new node (to the left) and release removed
    // component values.
    this.#move(entity, prev_node, next_node)
    this.#clear_many(entity, type)
  }

  /**
   * Marshal relationship nodes into a map indexed by the relationship's entity
   * id. This map is used to dispose an entity's relationship nodes when the
   * entity is despawned.
   */
  #record_relation_node = (node: Graph.Node) => {
    for (let i = 0; i < node.type.relationships.length; i++) {
      let relationship = node.type.relationships[i]
      let relationship_entity_id = Entity.parse_lo(relationship.id)
      let relationship_entity = EntityRegistry.hydrate(
        this.#entity_registry,
        relationship_entity_id,
      )
      // Get or create the list of relationship nodes for the relationship
      // entity.
      let entity_relationship_roots = (this.#entity_relationship_roots[
        relationship_entity
      ] ??= [])
      // Get or create the root relationship node and insert it into the
      // entity's list of relationship nodes.
      // TODO: This results in duplicate nodes in the array when more specific
      // nodes are created to the right of already-tracked nodes.
      entity_relationship_roots.push(
        Graph.resolve(this.graph, Type.make(relationship)),
      )
    }
  }

  /**
   * Remove all relationship nodes associated with an entity and move related
   * entities to the left in the graph.
   */
  #clear_entity_relationships(entity: Entity.T) {
    // Look up nodes that lead to the entity's relatives.
    let entity_relationship_roots = this.#entity_relationship_roots[entity]
    if (entity_relationship_roots === undefined) {
      return
    }
    for (let i = 0; i < entity_relationship_roots.length; i++) {
      let relationship_root = entity_relationship_roots[i]
      let relationship_relation = Type.component_at(
        relationship_root.type,
        0,
      ) as Component.TRelationship
      let relationship_store = this.store(relationship_relation.id)
      let relation_id = Entity.parse_hi(relationship_relation.id)
      let relation = Assert.exists(Component.get_relation(relation_id))
      // If the relationship is inclusive (i.e. not hierarchical), remove the
      // relationship from all related entities.
      if (relation.topology === Component.Topology.Inclusive) {
        Graph.move_entities_left(
          this.graph,
          relationship_root,
          relationship_relation,
          (entity, node) => {
            SparseMap.set(this.#nodes_by_entity, entity, node)
            relationship_store[entity] = undefined!
          },
        )
      }
      // Delete the root relationship node, which will also delete all
      // relationship nodes that lead to the entity's relatives.
      this.#nodes_to_delete.push(relationship_root)
    }
    this.#entity_relationship_roots[entity] = undefined!
  }

  /**
   * Apply a single command.
   */
  #apply_command = (command: Commands.T) => {
    switch (command.kind) {
      case "spawn":
        this.#apply_spawn(command)
        break
      case "despawn":
        this.#apply_despawn(command)
        break
      case "add":
        this.#apply_add(command)
        break
      case "remove":
        this.#apply_remove(command)
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
    let entity = EntityRegistry.retain(this.#entity_registry)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.spawn(
        type ? Type.with_relationships(type, values) : Type.make(),
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
    EntityRegistry.check(this.#entity_registry, entity)
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
    EntityRegistry.check(this.#entity_registry, entity)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.add(
        Type.has_relations(type)
          ? (Type.with_relationships(type, values) as Type.T<U>)
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
    EntityRegistry.check(this.#entity_registry, entity)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.remove(
        Type.has_relations(type)
          ? Type.with_relationships(type, relatives!)
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
    this.#locate(entity)
    let component = Type.component_at(type)
    if (Component.is_value_relation(component)) {
      let value = init as Commands.InitValueRelation<
        U extends Component.ValueRelation<infer V> ? V : never
      >
      this.#write_relationship(entity, component, value[0], value[1])
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
    let node = this.#locate(entity)
    let component = Type.component_at(type)
    if (Component.is_relation(component)) {
      let relationship = Entity.make(Assert.exists(relative), component.id)
      return Type.has_id(node.type, relationship)
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
    this.#locate(entity)
    let component = Type.component_at(type)
    if (Component.is_relation(component)) {
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
    let node = this.#locate(entity)
    return Type.has(
      node.type,
      Type.has_relations(type)
        ? Type.with_relationships(type, relatives)
        : type,
    )
  }

  /**
   * Step the world forward to the specified tick. If no tick is specified, the
   * world will step forward by one tick.
   */
  step(tick: number = this.#tick + 1) {
    // Execute all commands in the stage up to the given tick.
    while (this.#tick < tick) {
      Stage.drain_to(this.#stage, tick, this.#apply_command)
      this.#tick++
    }
    // Immediately despawn all entities whose nodes are marked for deletion.
    for (let i = 0; i < this.#nodes_to_delete.length; i++) {
      let node = this.#nodes_to_delete[i]
      Graph.traverse(node, node => {
        SparseSet.each(node.entities, entity => {
          this.#despawn(entity)
        })
      })
    }
    // Emit all entity transitions for monitor queries.
    Transition.drain(this.#transition, this.graph, "stage")
    // Drop all nodes marked for deletion.
    let node: Graph.Node
    while ((node = this.#nodes_to_delete.pop()!)) {
      Graph.delete_node(this.graph, node)
    }
  }

  getExclusiveRelative<U extends Component.TRelation>(
    entity: Entity.T,
    relation: Type.Unitary<U>,
  ) {
    let node = this.#locate(entity)
    let component = relation.components[0] as Component.TRelation
    if (component.topology !== Component.Topology.Exclusive) {
      throw new Error("Expected exclusive relation")
    }
    if (!Type.has(node.type, relation)) {
      throw new Error("Expected entity to have relation")
    }
    for (let i = 0; i < node.type.relationships.length; i++) {
      let relationship = node.type.relationships[i]
      let relationship_component_id = Entity.parse_hi(relationship.id)
      if (relationship_component_id === component.id) {
        return EntityRegistry.hydrate(
          this.#entity_registry,
          Entity.parse_lo(relationship.id),
        )
      }
    }
    throw new Error("Unexpected")
  }

  store(component_id: number) {
    return (this.stores[component_id] ??= [])
  }
}
export type T = World

export let make = (tick = 0): World => new World(tick)
