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
  #entity_nodes
  #entity_registry
  #entity_relationship_roots
  #stage
  #tick
  #transition

  readonly graph
  readonly stores
  readonly changes

  constructor(tick = 0) {
    this.#entity_nodes = SparseMap.make<Graph.Node>()
    this.#entity_registry = EntityRegistry.make()
    this.#entity_relationship_roots = [] as Graph.Node[][]
    this.#stage = Stage.make<Commands.T>()
    this.#tick = tick
    this.#transition = Transition.make()
    this.changes = Changes.make()
    this.graph = Graph.make()
    this.stores = [] as unknown[][]
    Signal.subscribe(this.graph.root.$created, this.#record_relation_node)
    Signal.subscribe(this.graph.root.$removed, this.#despawn_unhandled_entities)
  }

  /**
   * Move an entity from its current node to a new node.
   */
  #move(entity: Entity.T, prev_node: Graph.Node, next_node: Graph.Node) {
    Graph.remove_entity(prev_node, entity)
    Graph.insert_entity(next_node, entity)
    SparseMap.set(this.#entity_nodes, entity, next_node)
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
   * Update component values for an entity.
   */
  #write_many(entity: Entity.T, type: Type.T, init: unknown[]) {
    let init_index = 0
    for (let i = 0; i < type.component_spec.length; i++) {
      const component = type.component_spec[i]
      if (Component.is_value_relation(component)) {
        // Relation components may be initialized with a list of entity-value
        // pairs. Iterate each pair and write the value into the relationship's
        // component array.
        const value = init[init_index] as Commands.InitValueRelation
        for (let j = 0; j < value.length; j++) {
          const relationship_value = value[j]
          this.#write_relationship(
            entity,
            component,
            relationship_value[0],
            relationship_value[1],
          )
        }
        init_index++
      } else if (Component.is_value(component)) {
        const value = init[init_index]
        this.#write(entity, component, value)
        init_index++
      }
    }
  }

  /**
   * Clear component values for an entity.
   */
  #clear_many(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.components.length; i++) {
      const component = type.components[i]
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
    const relationship_component_id = Entity.make(
      Entity.parse_entity_id(relative),
      component.id,
    )
    this.store(relationship_component_id)[entity] = value
    this.#bump(entity, component)
  }

  /**
   * Insert a new entity into the entity graph and write initial component
   * values.
   */
  #commit_spawn(command: Commands.Spawn) {
    const {entity, type, init} = command
    const node = Graph.resolve(this.graph, type)
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
  #commit_despawn(command: Commands.Despawn) {
    this.#despawn(command.entity)
  }

  #despawn(entity: Entity.T) {
    const node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
    // Release all component values.
    this.#clear_many(entity, node.type)
    // Release all relationship nodes associated with this entity and move the
    // previously related entities to the left in the graph.
    this.#clear_entity_relationships(entity)
    // Remove the entity from the graph, forget its node, release the entity id
    // and record the move for monitor queries.
    Graph.remove_entity(node, entity)
    SparseMap.delete(this.#entity_nodes, entity)
    EntityRegistry.release(this.#entity_registry, entity)
    Transition.move(this.#transition, entity, node, this.graph.root)
  }

  /**
   * Add or update a component for an entity.
   */
  #commit_add(command: Commands.Add) {
    const {entity, type, init} = command
    const prev_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
    const next_type = Type.with(prev_node.type, type)
    const next_node = Graph.resolve(this.graph, next_type)
    // If the entity does not have one or more of the components in the added
    // type, move the entity to its new node.
    if (prev_node !== next_node) {
      this.#move(entity, prev_node, next_node)
      SparseMap.set(this.#entity_nodes, entity, next_node)
    }
    // Store added and updated component values.
    this.#write_many(entity, type, init)
  }

  /**
   * Remove components from an entity.
   */
  #commit_remove(command: Commands.Remove) {
    const {entity, type} = command
    const prev_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
    const next_type = Type.without(prev_node.type, type)
    const next_node = Graph.resolve(this.graph, next_type)
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
   * Despawn all entities of a node when the node is removed from the graph.
   */
  #despawn_unhandled_entities = (node: Graph.Node) => {
    SparseSet.each(node.entities, entity => {
      this.#despawn(entity)
    })
  }

  /**
   * Marshal relationship nodes into a map indexed by the relationship's entity
   * id. This map is used to dispose an entity's relationship nodes when the
   * entity is despawned.
   */
  #record_relation_node = (node: Graph.Node) => {
    for (let i = 0; i < node.type.relationships.length; i++) {
      const relationship = node.type.relationships[i]
      const relationship_entity_id = Entity.parse_entity_id(relationship.id)
      const relationship_entity = EntityRegistry.hydrate(
        this.#entity_registry,
        relationship_entity_id,
      )
      // Get or create the list of relationship nodes for the relationship
      // entity.
      const entity_relationship_roots = (this.#entity_relationship_roots[
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
    const entity_relationship_roots = this.#entity_relationship_roots[entity]
    if (entity_relationship_roots === undefined) {
      return
    }
    for (let i = 0; i < entity_relationship_roots.length; i++) {
      const relationship_root = entity_relationship_roots[i]
      const relationship_component = Type.component_at(
        relationship_root.type,
        0,
      ) as Component.TRelationship
      const relationship_store = this.store(relationship_component.id)
      const relation_component_id = Entity.parse_hi(relationship_component.id)
      const relation_component = Assert.exists(
        Component.get_relation(relation_component_id),
      )
      // If the relationship is cyclical (i.e. not hierarchical), remove the
      // relationship from all related entities.
      if (relation_component.topology === Component.Topology.Cyclical) {
        Graph.move_entities_left(
          this.graph,
          relationship_root,
          relationship_component,
          (entity, node) => {
            SparseMap.set(this.#entity_nodes, entity, node)
            relationship_store[entity] = undefined!
          },
        )
      }
      // Delete the root relationship node, which will also delete all
      // relationship nodes that lead to the entity's relatives. If the
      // relation is hierarchical, the entity's relatives will be despawned by
      // a listener added to the graph's $removed signal.
      Graph.delete_node(this.graph, relationship_root)
    }
    this.#entity_relationship_roots[entity] = undefined!
  }

  #get_relation<U extends Component.TRelation>(
    entity: Entity.T,
    relation: U,
    node: Graph.Node,
  ) {
    const out = [] as Commands.InitSingle<U>[]
    for (let i = 0; i < node.type.relationships.length; i++) {
      const relationship = node.type.relationships[i]
      const relationship_relation_id = Entity.parse_hi(relationship.id)
      if (relationship_relation_id === relation.id) {
        const relationship_entity_id = Entity.parse_entity_id(relationship.id)
        const relationship_entity = EntityRegistry.hydrate(
          this.#entity_registry,
          relationship_entity_id,
        )
        if (Component.is_tag(relation)) {
          out.push(relationship_entity as Commands.InitSingle<U>)
        } else {
          const relationship_value = this.#read(entity, relationship)
          out.push([
            relationship_entity,
            relationship_value,
          ] as Commands.InitSingle<U>)
        }
      }
    }
    return out as Commands.InitSingle<U>
  }

  #apply_command = (command: Commands.T) => {
    switch (command.kind) {
      case "spawn":
        this.#commit_spawn(command)
        break
      case "despawn":
        this.#commit_despawn(command)
        break
      case "add":
        this.#commit_add(command)
        break
      case "remove":
        this.#commit_remove(command)
        break
    }
  }

  get tick() {
    return this.#tick
  }

  store(component_id: number) {
    return (this.stores[component_id] ??= [])
  }

  spawn(): Entity.T
  spawn<U extends Component.T[]>(
    type: Type.Type<U>,
    ...values: Commands.Init<U>
  ): Entity.T
  spawn<U extends Component.T[]>(
    type?: Type.Type<U>,
    ...values: Commands.Init<U>
  ): Entity.T {
    const entity = EntityRegistry.retain(this.#entity_registry)
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

  change<U extends Component.Value | Component.ValueRelation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    init: Commands.InitSingle<U>,
  ) {
    const next_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(next_node !== undefined, DEBUG && "entity does not exist")
    const component = Type.component_at(type)
    if (Component.is_value_relation(component)) {
      type RelationInit = Commands.InitValueRelation<
        U extends Component.ValueRelation<infer V> ? V : never
      >
      for (let i = 0; i < (init as RelationInit).length; i++) {
        const value = (init as RelationInit)[i]
        this.#write_relationship(entity, component, value[0], value[1])
      }
    } else {
      this.#write(entity, component, init)
    }
  }

  step(tick: number = this.#tick + 1) {
    Transition.drain(this.#transition, this.graph, "stage")
    while (this.#tick < tick) {
      Stage.drain_to(this.#stage, tick, this.#apply_command)
      this.#tick++
    }
  }

  get<
    U extends Component.Value | Component.ValueRelation | Component.TagRelation,
  >(entity: Entity.T, type: Type.Unitary<U>): Commands.InitSingle<U> {
    const node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
    const component = Type.component_at(type)
    if (Component.is_relation(component)) {
      return this.#get_relation(entity, component, node)
    }
    return this.#read(entity, component) as Commands.InitSingle<U>
  }
}
export type T = World

export const make = (tick = 0): World => new World(tick)

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")
  const A = Component.tag()
  const B = Component.value()
  const C = Component.relation_tag()

  describe("World", () => {
    it("throws an error when adding a component to a non-existent entity", () => {
      const world = make()
      expect(() => world.add(123 as Entity.T, A)).to.throw()
    })
    it("throws an error when removing a component from a non-existent entity", () => {
      const world = make()
      expect(() => world.remove(123 as Entity.T, A)).to.throw()
    })
    it("adds a component to an entity", () => {
      const world = make()
      const entity = world.spawn()
      world.add(entity, B, 123)
      world.step()
      expect(world.get(entity, B)).to.equal(123)
    })
    it("removes a component from an entity", () => {
      const world = make()
      const entity = world.spawn()
      world.add(entity, B, 123)
      world.step()
      world.remove(entity, B)
      world.step()
      expect(world.get(entity, B)).to.equal(undefined)
    })
    it.only("adds a relation component to an entity", () => {
      const world = make()
      const relative = world.spawn()
      const entity = world.spawn(C, [relative])
      world.step()
      expect(world.get(entity, C)).to.deep.equal([relative])
    })
    it.todo("removes a relation component from an entity", () => {
      const world = make()
      const relative = world.spawn()
      const entity = world.spawn(C, [relative])
      world.step()
      world.remove(entity, C, [relative])
      world.step()
      expect(world.get(entity, C)).to.deep.equal([])
    })
  })
}
