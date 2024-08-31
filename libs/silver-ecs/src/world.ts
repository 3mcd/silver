import * as Assert from "./assert"
import * as Component from "./component"
import * as Effect from "./effect"
import * as Entity from "./entity"
import * as EntityBuilder from "./entity_builder"
import * as EntityRegistry from "./entity_registry"
import * as Graph from "./graph"
import * as Node from "./node"
import * as Op from "./op"
import * as Query from "./query"
import * as QueryBuilder from "./query_builder"
import * as SparseSet from "./sparse_set"
import * as Tx from "./transaction"
import * as Type from "./type"

export const $graph = Symbol()

class World {
  #id
  #entity_registry
  #entity_data
  #queries
  #resources
  #stage
  #tx;

  [$graph]: Graph.T

  constructor(id = 1) {
    this.#id = id
    this.#entity_registry = EntityRegistry.make()
    this.#entity_data = [] as unknown[][]
    this.#queries = new Map<QueryBuilder.T, Query.T>()
    this.#resources = [] as unknown[]
    this.#stage = [] as Op.T[]
    this.#tx = Tx.make()
    this[$graph] = Graph.make()
  }

  get_entity_node(entity: Entity.T) {
    let node = Tx.get_next_entity_node(this.#tx, entity)
    Assert.ok(node !== undefined)
    return node
  }

  #get_value(entity: Entity.T, component: Component.Ref) {
    let store = this.store(component.id)
    return store[entity]
  }

  #set_value<U extends Component.T>(
    entity: Entity.T,
    component: U,
    value: Component.ValueOf<U>,
  ) {
    let store = this.store(component.id)
    store[entity] = value
  }

  #set_values(entity: Entity.T, type: Type.T, values: unknown[]) {
    for (let i = 0; i < type.refs.length; i++) {
      let ref = type.refs[i]
      this.#set_value(entity, ref, values[ref.id])
    }
  }

  #unset_value(entity: Entity.T, ref: Component.Ref) {
    this.#set_value(entity, ref, undefined)
  }

  #unset_values(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.refs.length; i++) {
      let ref = type.refs[i]
      this.#unset_value(entity, ref)
    }
  }

  #despawn(entity: Entity.T) {
    let node = this.get_entity_node(entity)
    this.#unset_values(entity, node.type)
    this.#unset_relations(entity, node.type)
    EntityRegistry.free(this.#entity_registry, entity)
    Tx.move(this.#tx, entity)
  }

  #set_relations(subject: Entity.T, type: Type.T) {
    for (let i = 0; i < type.pairs.length; i++) {
      let pair = type.pairs[i]
      let rel_id = Entity.parse_hi(pair.id)
      let rel = Component.find_by_id(rel_id) as Component.Rel
      let rel_inverse = rel.inverse
      let object_id = Entity.parse_lo(pair.id)
      let object = Entity.make(object_id, this.#id)
      if (object === subject) {
        throw new Error("Cannot relate an entity to itself")
      }
      let object_node = this.get_entity_node(object)
      // grant the object entity the relation's inverse tag
      if (!Type.has_component(object_node.type, rel_inverse)) {
        this.#apply_add(Op.add(Type.make([rel_inverse]), object, []))
      }
      let next_object_node = this.get_entity_node(object)
      Node.set_object(next_object_node, rel_inverse.id, subject, object)
    }
  }

  #unset_relations(entity: Entity.T, type: Type.T) {
    for (let i = 0; i < type.pairs.length; i++) {
      let pair = type.pairs[i]
      let rel_id = Entity.parse_hi(pair.id)
      let rel = Component.find_by_id(rel_id) as Component.Rel
      let object_id = Entity.parse_lo(pair.id)
      let object = Entity.make(object_id, this.#id)
      let object_node = this.get_entity_node(object)
      switch (Node.unpair(object_node, rel.inverse.id, entity, object)) {
        // Object has no more subjects, so remove the relation's inverse tag.
        case 2:
        case 3:
          this.#apply_remove(Op.remove(Type.make([rel.inverse]), object))
          break
        default:
          break
      }
    }
  }

  /**
   * Move the `object` entity's subjects from `prev_node` to `next_node` for
   * each relation present in both nodes.
   */
  #move_relations(object: Entity.T, prev_node: Node.T, next_node: Node.T) {
    // For every relation type that this entity is an object of.
    for (let i = 0; i < prev_node.type.rels_inverse.length; i++) {
      let rel_inverse = prev_node.type.rels_inverse[i]
      let rel_map = prev_node.rel_maps[rel_inverse.id]
      let subjects = rel_map.b_to_a[object]
      if (subjects === undefined) {
        continue
      }
      if (Type.has_component(next_node.type, rel_inverse)) {
        SparseSet.each(subjects, subject => {
          Node.set_object(next_node, rel_inverse.id, subject, object)
        })
      }
      Node.delete_object(prev_node, rel_inverse.id, object)
    }
  }

  #apply_spawn(op: Op.Spawn) {
    let {entity, type, values} = op
    let node = Graph.find_or_create_node_by_type(this[$graph], type)
    this.#set_values(entity, type, values)
    this.#set_relations(entity, type)
    Tx.move(this.#tx, entity, node)
  }

  #apply_despawn(op: Op.Despawn) {
    this.#despawn(op.entity)
  }

  #apply_add(op: Op.Add) {
    let {entity, type, values} = op
    this.#set_values(entity, type, values)
    this.#set_relations(entity, type)
    let prev_node = this.get_entity_node(entity)
    let next_type = Type.from_sum(prev_node.type, type)
    let next_node = Graph.find_or_create_node_by_type(this[$graph], next_type)
    this.#move_relations(entity, prev_node, next_node)
    Tx.move(this.#tx, entity, next_node)
  }

  #apply_remove(op: Op.Remove) {
    let {entity, type} = op
    this.#unset_values(entity, type)
    this.#unset_relations(entity, type)
    let prev_node = this.get_entity_node(entity)
    let next_type = Type.from_difference(prev_node.type, type)
    let next_node = Graph.find_or_create_node_by_type(this[$graph], next_type)
    this.#move_relations(entity, prev_node, next_node)
    Tx.move(this.#tx, entity, next_node)
  }

  #apply_op(op: Op.T) {
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

  has_resource<U>(res: Component.Ref<U>): boolean {
    return this.#resources[res.id] !== undefined
  }

  set_resource<U>(res: Component.Ref<U>, resource: U) {
    this.#resources[res.id] = resource
  }

  get_resource<U>(res: Component.Ref<U>): U {
    return Assert.exists(this.#resources[res.id] as U)
  }

  spawn(): Entity.T
  spawn(type: Type.T, values: unknown[]): Entity.T
  spawn(type?: Type.T, values?: unknown[]): Entity.T {
    let entity = EntityRegistry.alloc(this.#entity_registry, this.#id)
    this.#stage.push(Op.spawn(type ?? Type.empty, entity, values as []))
    return entity
  }

  despawn(entity: Entity.T) {
    EntityRegistry.check(this.#entity_registry, entity)
    this.#stage.push(Op.despawn(entity))
  }

  add<U>(entity: Entity.T, ref: Component.Ref<U>, value: U): void
  add(entity: Entity.T, pair: Component.Pair): void
  add(entity: Entity.T, component: Component.T, value?: unknown) {
    EntityRegistry.check(this.#entity_registry, entity)
    this.#stage.push(
      Op.add(Type.make([component]), entity, (value ? [value] : []) as any),
    )
  }

  remove(
    entity: Entity.T,
    component: Component.Ref | Component.Tag | Component.Pair,
  ) {
    EntityRegistry.check(this.#entity_registry, entity)
    this.#stage.push(Op.remove(Type.make([component]), entity))
  }

  has(entity: Entity.T, component: Component.T): boolean {
    let node = this.get_entity_node(entity)
    return Type.has_component(node.type, component)
  }

  get<U extends Component.Ref>(entity: Entity.T, ref: U) {
    return this.#get_value(entity, ref) as Component.ValueOf<U>
  }

  set<U extends Component.Ref>(
    entity: Entity.T,
    ref: U,
    value: Component.ValueOf<U>,
  ) {
    this.#set_value(entity, ref, value)
  }

  step() {
    let stage = this.#stage
    if (this.#stage.length > 0) {
      for (let i = 0; i < this.#stage.length; i++) {
        let op = this.#stage[i]
        this.#apply_op(op)
      }
      this.#stage = []
    }
    Tx.apply(this.#tx, function move_entity_batch(batch, prev_node, next_node) {
      SparseSet.each(batch, function move_entity(entity) {
        if (prev_node) {
          Node.remove_entity(prev_node, entity)
        }
        if (next_node) {
          Node.insert_entity(next_node, entity)
        }
      })
    })
    return stage
  }

  get_exclusive_relative(entity: Entity.T, rel: Component.Rel) {
    let node = this.get_entity_node(entity)
    if (rel.topology !== Component.Topology.Exclusive) {
      throw new Error("Cannot get exclusive relative of inclusive relation")
    }
    if (!Type.has_component(node.type, rel)) {
      return undefined
    }
    for (let i = 0; i < node.type.pairs.length; i++) {
      let pair = node.type.pairs[i]
      let rel_id = Entity.parse_hi(pair.id)
      if (rel_id === rel.id) {
        let object_id = Entity.parse_lo(pair.id)
        return Entity.make(object_id, this.#id)
      }
    }
    throw new Error(
      "Unexpected error: entity has exclusive relation component without a pair",
    )
  }

  is_alive(entity: Entity.T) {
    return EntityRegistry.is_alive(this.#entity_registry, entity)
  }

  store(component_id: number) {
    let store = (this.#entity_data[component_id] ??= [])
    return store
  }

  single(ref: Component.Ref): Entity.T {
    let node = Graph.find_or_create_node_by_component(this[$graph], ref)
    let entity: Entity.T | undefined
    Node.traverse_right(node, visited_node => {
      // TODO: implement a better way to terminate traversal
      if (entity !== undefined) {
        return false
      }
      if (SparseSet.size(visited_node.entities) > 0) {
        entity = SparseSet.at(visited_node.entities, 0)
        return false
      }
    })
    return Assert.exists(entity)
  }

  with<U extends Component.Tag>(tag: U): EntityBuilder.T
  with<U extends Component.Ref>(
    ref: U,
    value: Component.ValueOf<U>,
  ): EntityBuilder.T
  with<U extends Component.Pair>(component: U): EntityBuilder.T
  with(
    component: Component.Tag | Component.Ref | Component.Pair,
    value?: unknown,
  ) {
    let builder = EntityBuilder.make(this)
    return Component.is_ref(component)
      ? builder.with(component, value)
      : builder.with(component)
  }

  for_each<U extends unknown[]>(
    query: QueryBuilder.T<U>,
    iteratee: Query.ForEachIteratee<U>,
  ) {
    let compiled_query = this.#queries.get(query) as Query.T<U>
    if (compiled_query === undefined) {
      compiled_query = Query.make(query, this)
      this.#queries.set(query, compiled_query)
    }
    compiled_query.for_each(iteratee)
  }

  add_effect<const U extends Effect.Term[]>(effect: Effect.T<U>) {
    let components = effect.terms.map(c => (typeof c === "function" ? c() : c))
    let type = Type.make(components)
    let node = Graph.find_or_create_node_by_type(this[$graph], type)
    Node.add_listener(node, effect, true)
    effect.world = this
  }
}
export type T = World

export let make = (): World => {
  return new World()
}

if (import.meta.vitest) {
  let {test, expect} = await import("vitest")

  test("relations", () => {
    let world = make()
    let Likes = Component.rel()
    let Likes_tag = Likes()
    let Likes_tag_inverse = Likes().inverse
    let a = world.spawn()
    let b = world.spawn()
    let c = world.spawn()
    world.step()
    world.add(a, Likes(b))
    world.add(a, Likes(c))
    world.step()
    expect(world.has(a, Likes_tag)).to.equal(true)
    expect(world.has(a, Likes(b))).to.equal(true)
    expect(world.has(a, Likes(c))).to.equal(true)
    expect(world.has(b, Likes_tag_inverse)).to.equal(true)
    expect(world.has(c, Likes_tag_inverse)).to.equal(true)
    world.remove(a, Likes(b))
    world.step()
    expect(world.has(a, Likes_tag)).to.equal(true)
    expect(world.has(a, Likes(b))).to.equal(false)
    expect(world.has(a, Likes(c))).to.equal(true)
    expect(world.has(b, Likes_tag_inverse)).to.equal(false)
    expect(world.has(c, Likes_tag_inverse)).to.equal(true)
    world.remove(a, Likes(c))
    world.step()
    expect(world.has(a, Likes_tag)).to.equal(false)
    expect(world.has(a, Likes(b))).to.equal(false)
    expect(world.has(a, Likes(c))).to.equal(false)
    expect(world.has(b, Likes_tag_inverse)).to.equal(false)
    expect(world.has(c, Likes_tag_inverse)).to.equal(false)
  })
}
