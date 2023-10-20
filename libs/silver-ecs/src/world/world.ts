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

type GetSingle<U extends Component.T> = U extends Component.Relation<infer V>
  ? Array<Commands.InitRelationship<V>>
  : U extends Component.Value<infer V>
  ? V
  : never

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
    Changes.bump(this.changes, Changes.make_key(entity, component.id))
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
    let j = 0
    for (let i = 0; i < type.components.length; i++) {
      const component = type.components[i]
      if (Component.is_relationship(component)) {
        const value = (values[j++] as [Entity.T, unknown])[1]
        this.#write(entity, component, value)
      } else if (Component.is_plain_value(component)) {
        this.#write(entity, component, values[j++])
      }
    }
  }

  #write_relationship<U extends Component.Relation>(
    entity: Entity.T,
    component: U,
    parent: Entity.T,
    value: U extends Component.Relation<infer V> ? V : never,
  ) {
    const relationship_component_id = Entity.make(
      Entity.parse_entity_id(parent),
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
    for (let i = 0; i < node.type.components.length; i++) {
      const component = node.type.components[i]
      if (Component.is_value(component)) {
        this.#write(entity, component, undefined)
      }
    }
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
    }
    this.#write_many(entity, type, init)
    SparseMap.set(this.#entity_nodes, entity, next_node)
  }

  #commit_remove(command: Commands.Remove) {
    const {entity, type} = command
    const prev_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
    const next_type = Type.without(prev_node.type, type)
    const next_node = Graph.resolve(this.graph, next_type)
    if (prev_node !== next_node) {
      this.#move(entity, prev_node, next_node)
    }
    for (let i = 0; i < type.components.length; i++) {
      const component = type.components[i]
      if (Component.is_relationship(component)) {
        this.#write(entity, component, undefined)
      } else if (Component.is_plain_value(component)) {
        this.#write(entity, component, undefined!)
      }
    }
    SparseMap.set(this.#entity_nodes, entity, next_node)
  }

  #commit_link(command: Commands.Link) {
    const {entity, type, parent, value} = command
    const prev_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
    const component = type.component_spec[0]
    const next_type = Type.with_component(
      prev_node.type,
      Component.make_relationship(component, parent),
    )
    const next_node = Graph.resolve(this.graph, next_type)
    this.#move(entity, prev_node, next_node)
    this.#bump(entity, component)
    if (Component.is_value(component)) {
      this.#write_relationship(entity, component, parent, value)
    }
  }

  #commit_unlink(command: Commands.Unlink) {
    const {entity, type, parent} = command
    const prev_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(prev_node !== undefined, DEBUG && "entity does not exist")
    const component = type.component_spec[0]
    const next_type = Type.without_component(
      prev_node.type,
      Component.make_relationship(component, parent),
    )
    const next_node = Graph.resolve(this.graph, next_type)
    this.#move(entity, prev_node, next_node)
    this.#bump(entity, component)
    if (Component.is_value(component)) {
      this.#write_relationship(entity, component, parent, undefined!)
    }
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
      case "link":
        this.#commit_link(command)
        break
      case "unlink":
        this.#commit_unlink(command)
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
        Type.with_relationships(type, values) as Type.T<U>,
        entity,
        values,
      ),
    )
  }

  remove<U extends Component.T[]>(entity: Entity.T, type: Type.Type<U>) {
    EntityRegistry.check(this.#entity_registry, entity)
    Stage.insert(this.#stage, this.#tick, Commands.remove(type, entity))
  }

  link<U extends Component.RelationTag>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    parent: Entity.T,
  ): void
  link<U extends Component.Relation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    parent: Entity.T,
    value: U extends Component.Relation<infer V> ? V : never,
  ): void
  link<U extends Component.Relation | Component.RelationTag>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    parent: Entity.T,
    value?: U extends Component.Relation<infer V> ? V : never,
  ) {
    const node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
    Stage.insert(
      this.#stage,
      this.#tick,
      Commands.link(entity, type, parent, value),
    )
  }

  unlink<U extends Component.Relation | Component.RelationTag>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    parent: Entity.T,
  ) {
    const node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
    Stage.insert(this.#stage, this.#tick, Commands.unlink(entity, type, parent))
  }

  change<U extends Component.Value | Component.Relation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    init: Commands.InitSingle<U>,
  ) {
    const component = type.component_spec[0]
    const next_node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(next_node !== undefined, DEBUG && "entity does not exist")
    if (Component.is_relation(component)) {
      type RelationInit = Commands.InitRelationship<
        U extends Component.Relation<infer V> ? V : never
      >
      const [parent, value] = init as RelationInit
      this.#write_relationship(entity, component, parent, value)
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

  get<U extends Component.Value | Component.Relation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
  ): GetSingle<U> {
    const node = SparseMap.get(this.#entity_nodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity does not exist")
    const component = type.component_spec[0]
    if (Component.is_relation(component)) {
      const out = [] as Array<Commands.InitRelationship<unknown>>
      for (let i = 0; i < node.type.relationships.length; i++) {
        const relationship = node.type.relationships[i]
        const relationship_relation_id = Entity.parse_hi(relationship.id)
        if (relationship_relation_id === component.id) {
          const relationship_entity_id = Entity.parse_entity_id(relationship.id)
          const relationship_entity = EntityRegistry.hydrate(
            this.#entity_registry,
            relationship_entity_id,
          )
          const relationship_value = this.#read(entity, relationship)
          out.push([relationship_entity, relationship_value])
        }
      }
      return out as GetSingle<U>
    }
    return this.#read(entity, component) as GetSingle<U>
  }
}
export type T = World

export const make = (time = 0): World => new World(time)

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")
  const A = Component.tag()

  describe("World", () => {
    it("throws an error when adding a component to a non-existent entity", () => {
      const world = make()
      expect(() => world.add(123 as Entity.T, A)).to.throw()
    })
    it("throws an error when removing a component from a non-existent entity", () => {
      const world = make()
      expect(() => world.remove(123 as Entity.T, A)).to.throw()
    })
  })
}
