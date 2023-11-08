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

  #store(component_id: number) {
    return (this.stores[component_id] ??= [])
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
    return this.#store(component.id)[entity]
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
    this.#store(component.id)[entity] = init
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
        // Relation components may be initialized with a list of entity-value
        // pairs. Iterate each pair and write the value into the relationship's
        // component array.
        let value = init[init_index] as Commands.InitValueRelation
        this.#write_relationship(entity, component, value[0], value[1])
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
    this.#store(relationship_component_id)[entity] = value
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
    let node = SparseMap.get(this.#nodes_by_entity, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
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
    let prev_node = SparseMap.get(this.#nodes_by_entity, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
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
    let prev_node = SparseMap.get(this.#nodes_by_entity, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
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
      let relationship_store = this.#store(relationship_relation.id)
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
      // Delet e the root relationship node, which will also delete all
      // relationship nodes that lead to the entity's relatives.
      this.#nodes_to_delete.push(relationship_root)
    }
    this.#entity_relationship_roots[entity] = undefined!
  }

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

  get tick() {
    return this.#tick
  }

  /**
   * Spawn an entity with no components.
   *
   * @example <caption>Spawn an container entity.</caption>
   * let InContainer = ecs.relation(ecs.Topology.Exclusive)
   * let Item = ecs.type(InContainer)
   * let bag = world.spawn()
   * let item = world.spawn(Item, bag)
   */
  spawn(): Entity.T
  spawn<U extends Component.T[]>(
    type: Type.Type<U>,
    ...values: Commands.Init<U>
  ): Entity.T
  spawn<U extends Component.T[]>(
    type?: Type.Type<U>,
    ...values: Commands.Init<U>
  ): Entity.T {
    let entity = EntityRegistry.retain(this.#entity_registry)
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.spawn(
        (type
          ? Type.with_relationships(type, values)
          : Type.make()) as Type.T<U>,
        entity,
        values,
      ),
    )
    return entity
  }

  despawn(entity: Entity.T) {
    EntityRegistry.check(this.#entity_registry, entity)
    Stage.insert(this.#stage, this.#tick, Commands.despawn(entity))
  }

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

  remove<U extends Component.TBase[]>(entity: Entity.T, type: Type.T<U>): void
  remove<U extends Component.T[]>(
    entity: Entity.T,
    type: Type.T<U>,
    relatives: Component.Related<U>,
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

  change<U extends Component.TValue>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    init: Commands.InitSingle<U>,
  ) {
    let next_node = SparseMap.get(this.#nodes_by_entity, entity)
    Assert.ok(next_node !== undefined, DEBUG && "entity does not exist")
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

  step(tick: number = this.#tick + 1) {
    // Immediately despawn all entities whose nodes are marked for delet ion.
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
    // Delet e all nodes marked for delet ion.
    let node: Graph.Node
    while ((node = this.#nodes_to_delete.pop()!)) {
      Graph.delete_node(this.graph, node)
    }
    // Execute all commands in the stage up to the given tick.
    while (this.#tick < tick) {
      Stage.drain_to(this.#stage, tick, this.#apply_command)
      this.#tick++
    }
  }

  get<U extends Component.Value>(
    entity: Entity.T,
    type: Type.Unitary<U>,
  ): Commands.InitSingle<U>
  get<U extends Component.ValueRelation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    relative: Entity.T,
  ): Commands.InitSingle<U>
  get<U extends Component.TValue>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    relative?: Entity.T,
  ): Commands.InitSingle<U> {
    let node = SparseMap.get(this.#nodes_by_entity, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
    let component = Type.component_at(type)
    if (Component.is_relation(component)) {
      let relationship = Entity.make(relative!, component.id)
      return this.#store(relationship)[entity] as Commands.InitSingle<U>
    }
    return this.#read(entity, component) as Commands.InitSingle<U>
  }
}
export type T = World

export let make = (tick = 0): World => new World(tick)

if (import.meta.vitest) {
  let {describe, it, expect} = await import("vitest")
  let A = Component.tag()
  let B = Component.value()
  let C = Component.valueRelation<number>()

  describe("World", () => {
    it("throws an error when adding a component to a non-existent entity", () => {
      let world = make()
      expect(() => world.add(123 as Entity.T, A)).to.throw()
    })
    it("throws an error when removing a component from a non-existent entity", () => {
      let world = make()
      expect(() => world.remove(123 as Entity.T, A)).to.throw()
    })
    it("adds a component to an entity", () => {
      let world = make()
      let entity = world.spawn()
      world.add(entity, B, 123)
      world.step()
      expect(world.get(entity, B)).to.equal(123)
    })
    it("removes a component from an entity", () => {
      let world = make()
      let entity = world.spawn()
      world.add(entity, B, 123)
      world.step()
      world.remove(entity, B)
      world.step()
      expect(world.get(entity, B)).to.equal(undefined)
    })
    it("adds a relation component to an entity", () => {
      let world = make()
      let relative = world.spawn()
      let entity = world.spawn(C, [relative, 123])
      world.step()
      expect(world.get(entity, C, relative)).to.equal(123)
    })
    it("removes a relation component from an entity", () => {
      let world = make()
      let relative = world.spawn()
      let entity = world.spawn(C, [relative, 123])
      world.step()
      world.remove(entity, C, [relative])
      world.step()
      expect(world.get(entity, C, relative)).toBeUndefined()
    })
    it("throws when adding a parent to an entity that already has a parent of a given hierarchical relation", () => {
      // Error
      let world = make()
      let Child = Component.relation(Component.Topology.Exclusive)
      let parentA = world.spawn()
      let parentB = world.spawn()
      let child = world.spawn(Child, parentA)
      world.add(child, Child, parentB)
      expect(world.step).toThrow()
    })
  })
}
