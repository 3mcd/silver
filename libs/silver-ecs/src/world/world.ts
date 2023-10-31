import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as EntityRegistry from "../entity/entity_registry"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as Stage from "../stage"
import * as Changes from "./changes"
import * as Commands from "./commands"
import * as Graph from "./graph"
import * as Transition from "./transition"

export class World {
  #entity_nodes
  #entity_registry
  #entity_relationship_nodes
  #stage
  #tick
  #transition

  readonly graph
  readonly stores
  readonly changes

  constructor(time: number) {
    this.#entity_nodes = SparseMap.make<Graph.Node>()
    this.#entity_registry = EntityRegistry.make()
    this.#entity_relationship_nodes = [] as Graph.Node[][]
    this.#stage = Stage.make<Commands.T>()
    this.#tick = time
    this.#transition = Transition.make()
    this.changes = Changes.make()
    this.graph = Graph.make()
    this.stores = [] as unknown[][]
    Signal.subscribe(this.graph.root.$created, this.#record_relation_node)
  }

  #move(entity: Entity.T, prev_node: Graph.Node, next_node: Graph.Node) {
    Graph.remove_entity(prev_node, entity)
    Graph.insert_entity(next_node, entity)
    SparseMap.set(this.#entity_nodes, entity, next_node)
    Transition.move(this.#transition, entity, prev_node, next_node)
  }

  #bump(entity: Entity.T, component: Component.T) {
    Changes.bump(this.changes, entity, component.id)
  }

  #read<U extends Component.T>(entity: Entity.T, component: U) {
    return this.store(component.id)[entity]
  }

  #write<U extends Component.T>(
    entity: Entity.T,
    component: U,
    init: Commands.InitSingle<U>,
  ) {
    this.store(component.id)[entity] = init
    this.#bump(entity, component)
  }

  #write_many(entity: Entity.T, type: Type.T, values: unknown[]) {
    let init_index = 0
    for (let i = 0; i < type.component_spec.length; i++) {
      const component = type.component_spec[i]
      if (Component.is_value_relation(component)) {
        const value = values[init_index] as Commands.InitValueRelation
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
        const value = values[init_index]
        this.#write(entity, component, value)
        init_index++
      }
    }
  }

  #clear_many(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.components.length; i++) {
      const component = type.components[i]
      if (Component.stores_value(component)) {
        this.#write(entity, component, undefined)
      }
    }
  }

  #write_relationship<U extends Component.ValueRelation>(
    entity: Entity.T,
    component: U,
    relative: Entity.T,
    value: unknown,
  ) {
    const relationship_component_id = Entity.make(
      Entity.parse_entity_id(relative),
      component.id,
    )
    this.store(relationship_component_id)[entity] = value
    this.#bump(entity, component)
  }

  #commit_spawn(command: Commands.Spawn) {
    const {entity, type, init} = command
    const node = Graph.resolve(this.graph, type)
    Graph.insert_entity(node, entity)
    this.#write_many(entity, type, init)
    this.#move(entity, this.graph.root, node)
  }

  #commit_despawn(command: Commands.Despawn) {
    const {entity} = command
    const node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
    Graph.remove_entity(node, entity)
    SparseMap.delete(this.#entity_nodes, entity)
    EntityRegistry.release(this.#entity_registry, entity)
    this.#clear_many(entity, node.type)
    this.#clear_entity_relationships(entity)
    Transition.move(this.#transition, entity, node, this.graph.root)
  }

  #commit_add(command: Commands.Add) {
    const {entity, type, init} = command
    const prev_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
    const next_type = Type.with(prev_node.type, type)
    const next_node = Graph.resolve(this.graph, next_type)
    if (prev_node !== next_node) {
      this.#move(entity, prev_node, next_node)
      SparseMap.set(this.#entity_nodes, entity, next_node)
    }
    this.#write_many(entity, type, init)
  }

  #commit_remove(command: Commands.Remove) {
    const {entity, type} = command
    const prev_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
    const next_type = Type.without(prev_node.type, type)
    const next_node = Graph.resolve(this.graph, next_type)
    if (prev_node !== next_node) {
      this.#move(entity, prev_node, next_node)
      SparseMap.set(this.#entity_nodes, entity, next_node)
    }
    this.#clear_many(entity, type)
  }

  #record_relation_node = (node: Graph.Node) => {
    for (let i = 0; i < node.type.relationships.length; i++) {
      const relationship = node.type.relationships[i]
      const relationship_entity_id = Entity.parse_entity_id(relationship.id)
      const relationship_entity = EntityRegistry.hydrate(
        this.#entity_registry,
        relationship_entity_id,
      )
      const entity_relationship_nodes = (this.#entity_relationship_nodes[
        relationship_entity
      ] ??= [])
      entity_relationship_nodes.push(
        Graph.resolve(this.graph, Type.make(relationship)),
      )
    }
  }

  #clear_entity_relationships(entity: Entity.T) {
    const entity_relationship_nodes = this.#entity_relationship_nodes[entity]
    if (entity_relationship_nodes === undefined) return
    for (let i = 0; i < entity_relationship_nodes.length; i++) {
      const relationship_node = entity_relationship_nodes[i]
      const relationship_component = relationship_node.type.relationships[0]
      const relationship_store = this.store(relationship_component.id)
      Graph.move_entities_rem(
        this.graph,
        relationship_node,
        relationship_component,
        (entity, node) => {
          SparseMap.set(this.#entity_nodes, entity, node)
          relationship_store[entity] = undefined!
        },
      )
      Graph.delete_node(this.graph, relationship_node)
    }
    this.#entity_relationship_nodes[entity] = undefined!
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

  step(time: number = this.#tick + 1) {
    Transition.drain(this.#transition, this.graph, "stage")
    while (this.#tick < time) {
      Stage.drain_to(this.#stage, time, this.#apply_command)
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
      const out = [] as Commands.InitSingle<U>[]
      for (let i = 0; i < node.type.relationships.length; i++) {
        const relationship = node.type.relationships[i]
        const relationship_relation_id = Entity.parse_hi(relationship.id)
        if (relationship_relation_id === component.id) {
          const relationship_entity_id = Entity.parse_entity_id(relationship.id)
          const relationship_entity = EntityRegistry.hydrate(
            this.#entity_registry,
            relationship_entity_id,
          )
          if (Component.is_tag(component)) {
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
    return this.#read(entity, component) as Commands.InitSingle<U>
  }
}
export type T = World

export const make = (time = 0): World => new World(time)

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
