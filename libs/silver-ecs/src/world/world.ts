import * as Assert from "../assert"
import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Entity from "../entity/entity"
import * as EntityRegistry from "../entity/entity_registry"
import * as Signal from "../signal"
import * as SparseMap from "../sparse/sparse_map"
import * as StepBuffer from "../step_buffer"
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
  #stage
  #entityNodes
  #entityRegistry
  #entityRelationshipNodes
  #tick
  #transition

  readonly graph
  readonly stores
  readonly changes

  constructor(time: number) {
    this.#stage = StepBuffer.make<Commands.T>()
    this.#entityNodes = SparseMap.make<Graph.Node>()
    this.#entityRegistry = EntityRegistry.make()
    this.#entityRelationshipNodes = [] as Graph.Node[][]
    this.#tick = time
    this.#transition = Transition.make()
    this.graph = Graph.make()
    this.stores = [] as unknown[][]
    this.changes = Changes.make()
    Signal.subscribe(this.graph.root.$created, this.#recordRelationNode)
  }

  get tick() {
    return this.#tick
  }

  store(componentId: number) {
    const store = (this.stores[componentId] ??= [])
    return store
  }

  #move(entity: Entity.T, prevNode: Graph.Node, nextNode: Graph.Node) {
    Graph.removeEntity(prevNode, entity)
    Graph.insertEntity(nextNode, entity)
    SparseMap.set(this.#entityNodes, entity, nextNode)
    Transition.move(this.#transition, entity, prevNode, nextNode)
  }

  #bump(entity: Entity.T, component: Component.T) {
    Changes.bump(this.changes, Changes.makeKey(entity, component.id))
  }

  #write<U extends Component.Value | Component.Relation>(
    entity: Entity.T,
    component: U,
    init: Commands.InitSingle<U>,
  ) {
    this.store(component.id)[entity] = init
    this.#bump(entity, component)
  }

  #writeMany(entity: Entity.T, type: Type.T, values: unknown[]) {
    let j = 0
    for (let i = 0; i < type.components.length; i++) {
      const component = type.components[i]
      if (Component.isRelationship(component)) {
        const value = (values[j++] as [Entity.T, unknown])[1]
        this.store(component.id)[entity] = value
      } else if (
        Component.isValue(component) &&
        !Component.isRelation(component)
      ) {
        this.#write(entity, component, values[j++])
      }
    }
  }

  #writeRelationship<U extends Component.Relation>(
    entity: Entity.T,
    component: U,
    parent: Entity.T,
    value: U extends Component.Relation<infer V> ? V : never,
  ) {
    const rid = Entity.make(Entity.parseEntityId(parent), component.id)
    this.store(rid)[entity] = value
    this.#bump(entity, component)
  }

  #commitSpawn(command: Commands.Spawn) {
    const {entity, type, init} = command
    const node = Graph.resolve(this.graph, type)
    Graph.insertEntity(node, entity)
    this.#writeMany(entity, type, init)
    this.#move(entity, this.graph.root, node)
  }

  #commitDespawn(command: Commands.Despawn) {
    const {entity} = command
    const node = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity could not be located")
    Graph.removeEntity(node, entity)
    SparseMap.delete(this.#entityNodes, entity)
    EntityRegistry.release(this.#entityRegistry, entity)
    for (let i = 0; i < node.type.components.length; i++) {
      const component = node.type.components[i]
      if (Component.isValue(component)) {
        this.store(component.id)[entity] = undefined!
      }
    }
    this.#clearEntityRelationships(entity)
    Transition.move(this.#transition, entity, node, this.graph.root)
  }

  #commitAdd(command: Commands.Add) {
    const {entity, type, init} = command
    const prevNode = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(prevNode !== undefined, DEBUG && "entity could not be located")
    const nextType = Type.with(prevNode.type, type)
    const nextNode = Graph.resolve(this.graph, nextType)
    if (prevNode !== nextNode) {
      this.#move(entity, prevNode, nextNode)
    }
    this.#writeMany(entity, type, init)
    SparseMap.set(this.#entityNodes, entity, nextNode)
  }

  #commitRemove(command: Commands.Remove) {
    const {entity, type} = command
    const prevNode = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(prevNode !== undefined, DEBUG && "entity could not be located")
    const nextType = Type.without(prevNode.type, type)
    const nextNode = Graph.resolve(this.graph, nextType)
    if (prevNode !== nextNode) {
      this.#move(entity, prevNode, nextNode)
    }
    for (let i = 0; i < type.components.length; i++) {
      const component = type.components[i]
      if (Component.isRelationship(component)) {
        this.store(component.id)[entity] = undefined!
      } else if (
        Component.isValue(component) &&
        !Component.isRelation(component)
      ) {
        this.#write(entity, component, undefined!)
      }
    }
    SparseMap.set(this.#entityNodes, entity, nextNode)
  }

  #commitLink(command: Commands.Link) {
    const {entity, type, parent, value} = command
    const prevNode = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(prevNode !== undefined, DEBUG && "entity could not be located")
    const component = type.componentSpec[0]
    const nextType = Type.withComponent(
      prevNode.type,
      Component.makeRelationship(component, parent),
    )
    const nextNode = Graph.resolve(this.graph, nextType)
    this.#move(entity, prevNode, nextNode)
    this.#bump(entity, component)
    if (Component.isValue(component)) {
      this.#writeRelationship(entity, component, parent, value)
    }
  }

  #commitUnlink(command: Commands.Unlink) {
    const {entity, type, parent} = command
    const prevNode = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(prevNode !== undefined, DEBUG && "entity could not be located")
    const component = type.componentSpec[0]
    const nextType = Type.withoutComponent(
      prevNode.type,
      Component.makeRelationship(component, parent),
    )
    const nextNode = Graph.resolve(this.graph, nextType)
    this.#move(entity, prevNode, nextNode)
    this.#bump(entity, component)
    if (Component.isValue(component)) {
      this.#writeRelationship(entity, component, parent, undefined!)
    }
  }

  #recordRelationNode = (node: Graph.Node) => {
    for (let i = 0; i < node.type.relationships.length; i++) {
      const relationship = node.type.relationships[i]
      const relationshipEntityId = Entity.parseEntityId(relationship.id)
      const relationshipEntity = EntityRegistry.hydrate(
        this.#entityRegistry,
        relationshipEntityId,
      )
      const entityRelationshipNodes = (this.#entityRelationshipNodes[
        relationshipEntity
      ] ??= [])
      entityRelationshipNodes.push(
        Graph.resolve(this.graph, Type.make(relationship)),
      )
    }
  }

  #clearEntityRelationships(entity: Entity.T) {
    const entityRelationshipNodes = this.#entityRelationshipNodes[entity]
    if (entityRelationshipNodes === undefined) return
    for (let i = 0; i < entityRelationshipNodes.length; i++) {
      const relationshipNode = entityRelationshipNodes[i]
      const relationshipComponent = relationshipNode.type.relationships[0]
      const relationshipStore = this.store(relationshipComponent.id)
      Graph.moveEntitiesRem(
        this.graph,
        relationshipNode,
        relationshipComponent,
        (entity, node) => {
          SparseMap.set(this.#entityNodes, entity, node)
          relationshipStore[entity] = undefined!
        },
      )
      Graph.deleteNode(this.graph, relationshipNode)
    }
    this.#entityRelationshipNodes[entity] = undefined!
  }

  #applyCommand = (command: Commands.T) => {
    switch (command.kind) {
      case "spawn":
        this.#commitSpawn(command)
        break
      case "despawn":
        this.#commitDespawn(command)
        break
      case "add":
        this.#commitAdd(command)
        break
      case "remove":
        this.#commitRemove(command)
        break
      case "link":
        this.#commitLink(command)
        break
      case "unlink":
        this.#commitUnlink(command)
        break
    }
  }

  spawn<U extends Component.T[]>(
    type: Type.Type<U>,
    ...values: Commands.Init<U>
  ): Entity.T {
    const entity = EntityRegistry.retain(this.#entityRegistry)
    StepBuffer.insert(
      this.#stage,
      this.#tick,
      Commands.spawn(
        Type.hydrateRelationships(type, values) as Type.T<U>,
        entity,
        values,
      ),
    )
    return entity
  }

  despawn(entity: Entity.T) {
    EntityRegistry.check(this.#entityRegistry, entity)
    StepBuffer.insert(this.#stage, this.#tick, Commands.despawn(entity))
  }

  add<U extends Component.T[]>(
    entity: Entity.T,
    type: Type.Type<U>,
    ...values: Commands.Init<U>
  ) {
    EntityRegistry.check(this.#entityRegistry, entity)
    StepBuffer.insert(
      this.#stage,
      this.#tick,
      Commands.add(
        Type.hydrateRelationships(type, values) as Type.T<U>,
        entity,
        values,
      ),
    )
  }

  remove<U extends Component.T[]>(entity: Entity.T, type: Type.Type<U>) {
    EntityRegistry.check(this.#entityRegistry, entity)
    StepBuffer.insert(this.#stage, this.#tick, Commands.remove(type, entity))
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
    const node = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity could not be located")
    StepBuffer.insert(
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
    const node = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity could not be located")
    StepBuffer.insert(
      this.#stage,
      this.#tick,
      Commands.unlink(entity, type, parent),
    )
  }

  change<U extends Component.Value | Component.Relation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
    init: Commands.InitSingle<U>,
  ) {
    const component = type.componentSpec[0]
    const nextNode = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(nextNode !== undefined, DEBUG && "entity could not be located")
    if (Component.isRelation(component)) {
      const [parent, value] = init as Commands.InitRelationship<
        U extends Component.Relation<infer V> ? V : never
      >
      this.#writeRelationship(entity, component, parent, value)
    } else {
      this.#write(entity, component, init)
    }
  }

  step(time: number = this.#tick + 1) {
    Transition.drain(this.#transition, this.graph, "stage")
    while (this.#tick < time) {
      StepBuffer.drainBetween(this.#stage, this.#tick, time, this.#applyCommand)
      this.#tick++
    }
  }

  get<U extends Component.Value | Component.Relation>(
    entity: Entity.T,
    type: Type.Unitary<U>,
  ): GetSingle<U> {
    const node = SparseMap.get(this.#entityNodes, entity)
    Assert.ok(node !== undefined, DEBUG && "entity could not be located")
    const component = type.componentSpec[0]
    if (Component.isRelation(component)) {
      const out = [] as Array<Commands.InitRelationship<unknown>>
      for (let i = 0; i < node.type.relationships.length; i++) {
        const relationship = node.type.relationships[i]
        const relationshipRelationId = Entity.parseHi(relationship.id)
        if (relationshipRelationId === component.id) {
          const relationshipEntityId = Entity.parseEntityId(relationship.id)
          const relationshipEntity = EntityRegistry.hydrate(
            this.#entityRegistry,
            relationshipEntityId,
          )
          const relationshipValue = this.store(relationship.id)[entity]
          out.push([relationshipEntity, relationshipValue])
        }
      }
      return out as GetSingle<U>
    }
    return this.store(component.id)[entity] as GetSingle<U>
  }
}
export type T = World

export const make = (time = 0): World => new World(time)
