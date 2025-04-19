import {assert, assert_exists} from "./assert.ts"
import * as Component from "./component.ts"
import * as Effect from "./effect.ts"
import * as Entity from "./entity.ts"
import * as EntityBuilder from "./entity_builder.ts"
import * as EntityRegistry from "./entity_registry.ts"
import * as Graph from "./graph.ts"
import * as Node from "./node.ts"
import * as Op from "./op.ts"
import * as Query from "./query.ts"
import * as Selector from "./selector.ts"
import * as Stage from "./stage.ts"
import * as Type from "./type.ts"

let err_missing_res = "missing resource"
let err_missing_entity = "missing entity"
let err_missing_entity_single = "no entity found for single"
let err_missing_entity_exclusive = "missing exclusive relative"
let err_missing_pair =
  "Unexpected error: entity has exclusive relation component without a pair"
let err_inclusive = "Cannot get exclusive relative of inclusive relation"
let err_self_rel = "Cannot relate an entity to itself"

export const $graph = Symbol()

export class World {
  #entity_registry
  #entity_data
  #id
  #ops
  #queries
  #resources
  #stage

  /** @internal */
  readonly graph: Graph.t

  constructor(id = 0) {
    this.#entity_data = [] as unknown[][]
    this.#entity_registry = EntityRegistry.make()
    this.#id = id
    this.#ops = [] as Op.t[]
    this.#queries = new Map<Selector.t, Query.t>()
    this.#resources = [] as unknown[]
    this.#stage = Stage.make()
    this.graph = Graph.make()
  }

  /** @internal */
  get_entity_node(entity: Entity.t) {
    return assert_exists(
      this.#stage.get_next_entity_node(entity),
      err_missing_entity,
    )
  }

  #get_value(entity: Entity.t, component: Component.Ref) {
    let array = this.array(component.id)
    return array[entity]
  }

  #set_value<U extends Component.t>(
    entity: Entity.t,
    component: U,
    value: Component.ValueOf<U>,
  ) {
    let array = this.array(component.id)
    array[entity] = value
  }

  #set_values(entity: Entity.t, type: Type.t, values: unknown[]) {
    for (let i = 0; i < type.refs.length; i++) {
      let ref = type.refs[i]
      let ref_value = values[ref.id]
      this.#set_value(entity, ref, ref_value)
    }
  }

  #unset_value(entity: Entity.t, ref: Component.Ref) {
    this.#set_value(entity, ref, undefined)
  }

  #unset_values(entity: Entity.t, type: Type.t) {
    for (let i = 0; i < type.refs.length; i++) {
      let ref = type.refs[i]
      this.#unset_value(entity, ref)
    }
  }

  #set_relations(subject: Entity.t, type: Type.t) {
    for (let i = 0; i < type.pairs.length; i++) {
      let pair = type.pairs[i]
      let rel_id = Component.parse_pair_rel_id(pair)
      let rel = Component.find_by_id(rel_id) as Component.Rel
      let rel_inverse = rel.inverse
      let object_id = Component.parse_pair_entity(pair)
      let object = Entity.make(object_id, this.#id)
      assert(object !== subject, err_self_rel)
      let object_node = this.get_entity_node(object)
      // grant the object entity the relation's inverse tag
      if (!object_node.type.has_component(rel_inverse)) {
        this.#apply_add(object, Type.single(rel_inverse))
      }
      let next_object_node = this.get_entity_node(object)
      next_object_node.set_object(rel_inverse.id, subject, object)
    }
  }

  #unset_relations(entity: Entity.t, type: Type.t) {
    let node = this.get_entity_node(entity)
    for (let i = 0; i < type.rels_inverse.length; i++) {
      let rel_inverse = type.rels_inverse[i]
      let rel_map = node.rel_maps[rel_inverse.id]
      let subjects = rel_map.b_to_a[entity]
      subjects?.for_each(subject => {
        this.#apply_remove(
          subject,
          Type.single(Component.make_pair(rel_inverse.rel, entity)),
        )
      })
      rel_map.delete_object(entity)
    }
    for (let i = 0; i < type.pairs.length; i++) {
      let pair = type.pairs[i]
      let rel_id = Component.parse_pair_rel_id(pair)
      let rel = Component.find_by_id(rel_id) as Component.Rel
      let object_id = Component.parse_pair_entity(pair)
      let object = Entity.make(object_id, this.#id)
      let object_node = this.get_entity_node(object)
      switch (object_node.unpair(rel.inverse.id, entity, object)) {
        // object has no more subjects, so remove the relation's inverse tag
        case 2:
        case 3: {
          this.#apply_remove(object, Type.single(rel.inverse))
          break
        }
        default:
          break
      }
    }
  }

  /**
   * Move the `object` entity's subjects from `prev_node` to `next_node` for
   * each relation present in both nodes.
   */
  #move_relations(object: Entity.t, prev_node: Node.t, next_node: Node.t) {
    // for every relation type that this entity is an object of
    for (let i = 0; i < prev_node.type.rels_inverse.length; i++) {
      let rel_inverse = prev_node.type.rels_inverse[i]
      let rel_map = prev_node.rel_maps[rel_inverse.id]
      let subjects = rel_map.b_to_a[object]
      if (subjects === undefined) {
        continue
      }
      if (next_node.type.has_component(rel_inverse)) {
        subjects.for_each(subject => {
          next_node.set_object(rel_inverse.id, subject, object)
        })
      }
      prev_node.delete_object(rel_inverse.id, object)
    }
  }

  #apply_spawn(entity: Entity.t, type: Type.t, values: unknown[]) {
    let node = this.graph.find_or_create_node_by_type(type)
    this.#set_values(entity, type, values)
    this.#set_relations(entity, type)
    this.#stage.move(entity, node)
  }

  #apply_spawn_op(op: Op.Spawn) {
    this.#apply_spawn(op.entity, op.type, op.values)
  }

  #apply_despawn(entity: Entity.t) {
    let node = this.get_entity_node(entity)
    this.#unset_relations(entity, node.type)
    let entity_hi = Entity.parse_hi(entity)
    if (entity_hi === this.#id || entity_hi === 0) {
      this.#entity_registry.free(entity)
    }
    this.#stage.move(entity)
  }

  #apply_despawn_op(op: Op.Despawn) {
    let node = this.get_entity_node(op.entity)
    op.type = node.type
    this.#apply_despawn(op.entity)
  }

  #apply_add(entity: Entity.t, type: Type.t, values?: unknown[]) {
    if (values !== undefined) {
      this.#set_values(entity, type, values)
    }
    this.#set_relations(entity, type)
    let prev_node = this.get_entity_node(entity)
    let next_type = prev_node.type.from_sum(type)
    let next_node = this.graph.find_or_create_node_by_type(next_type)
    if (next_node !== prev_node) {
      this.#move_relations(entity, prev_node, next_node)
      this.#stage.move(entity, next_node)
    }
  }

  #apply_add_op(op: Op.Add) {
    this.#apply_add(op.entity, op.type, op.values)
  }

  #apply_remove(entity: Entity.t, type: Type.t) {
    // this.#unset_values(entity, type)
    this.#unset_relations(entity, type)
    let prev_node = this.get_entity_node(entity)
    let next_type = prev_node.type.from_difference(type)
    let next_node = this.graph.find_or_create_node_by_type(next_type)
    if (next_node !== prev_node) {
      this.#move_relations(entity, prev_node, next_node)
      this.#stage.move(entity, next_node)
    }
  }

  #apply_remove_op(op: Op.Remove) {
    this.#apply_remove(op.entity, op.type)
  }

  #apply_op(op: Op.t) {
    switch (op.kind) {
      case Op.Kind.Spawn:
        this.#apply_spawn_op(op)
        break
      case Op.Kind.Despawn:
        this.#apply_despawn_op(op)
        break
      case Op.Kind.Add:
        this.#apply_add_op(op)
        break
      case Op.Kind.Remove:
        this.#apply_remove_op(op)
        break
    }
  }

  #resolve_query<U extends unknown[]>(query: Selector.t<U>): Query.t<U> {
    let compiled_query = this.#queries.get(query)
    if (compiled_query === undefined) {
      compiled_query = Query.make(query, this)
      this.#queries.set(query, compiled_query)
    }
    return compiled_query as Query.t<U>
  }

  identify(id: number) {
    this.#id = id
  }

  has_resource<U>(res: Component.Ref<U>): boolean {
    return this.#resources[res.id] !== undefined
  }

  set_resource<U>(res: Component.Ref<U>, resource: U) {
    this.#resources[res.id] = resource
    return this
  }

  get_resource<U>(res: Component.Ref<U>): U {
    return assert_exists(this.get_resource_opt(res), err_missing_res)
  }

  get_resource_opt<U>(res: Component.Ref<U>): U | undefined {
    return this.#resources[res.id] as U | undefined
  }

  spawn(): Entity.t
  spawn(type: Type.t, values: unknown[]): Entity.t
  spawn(type?: Type.t, values?: unknown[]): Entity.t {
    let entity = this.#entity_registry.alloc(this.#id)
    let op = Op.spawn(entity, type ?? Type.empty, values as [])
    this.#ops.push(op)
    return entity
  }

  despawn(entity: Entity.t) {
    this.#entity_registry.check(entity)
    let op = Op.despawn(entity)
    this.#ops.push(op)
  }

  reserve(entity: Entity.t, type: Type.t, values: unknown[]) {
    let op = Op.spawn(entity, type ?? Type.empty, values as [])
    this.#ops.push(op)
  }

  add<U>(entity: Entity.t, ref: Component.Ref<U>, value: U): void
  add(entity: Entity.t, pair: Component.Pair): void
  add(entity: Entity.t, tag: Component.Tag): void
  add(entity: Entity.t, component: Component.t, value?: unknown) {
    this.#entity_registry.check(entity)
    let values: unknown[] = []
    if (value !== undefined) {
      values[component.id] = value
    }
    let op = Op.add(entity, component, values as [])
    this.#ops.push(op)
  }

  remove(
    entity: Entity.t,
    component: Component.Ref | Component.Tag | Component.Pair,
  ) {
    if (this.#entity_registry.is_alive(entity)) {
      let op = Op.remove(entity, component)
      this.#ops.push(op)
    }
  }

  has(entity: Entity.t, component: Component.t): boolean {
    let node = this.get_entity_node(entity)
    return node.type.has_component(component)
  }

  get<U extends Component.Ref>(entity: Entity.t, ref: U) {
    return this.#get_value(entity, ref) as Component.ValueOf<U>
  }

  set<U extends Component.Ref>(
    entity: Entity.t,
    ref: U,
    value: Component.ValueOf<U>,
  ) {
    this.#set_value(entity, ref, value)
  }

  step() {
    let ops = this.#ops
    if (this.#ops.length > 0) {
      for (let i = 0; i < this.#ops.length; i++) {
        let op = this.#ops[i]
        this.#apply_op(op)
      }
      this.#ops = []
    }
    this.#stage.apply()
    for (let i = 0; i < ops.length; i++) {
      let op = ops[i]
      switch (op.kind) {
        case Op.Kind.Remove:
        case Op.Kind.Despawn:
          this.#unset_values(op.entity, assert_exists(op.type))
          break
      }
    }
    return ops
  }

  get_exclusive_relative_opt(
    entity: Entity.t,
    rel: Component.Rel | Component.PairFn,
  ) {
    if (typeof rel === "function") {
      rel = rel()
    }
    let node = this.get_entity_node(entity)
    assert(rel.topology === Component.Topology.Exclusive, err_inclusive)
    if (!node.type.has_component(rel)) {
      return undefined
    }
    for (let i = 0; i < node.type.pairs.length; i++) {
      let pair = node.type.pairs[i]
      let rel_id = Component.parse_pair_rel_id(pair)
      if (rel_id === rel.id) {
        return Component.parse_pair_entity(pair)
      }
    }
    throw new Error(err_missing_pair)
  }

  get_exclusive_relative(
    entity: Entity.t,
    rel: Component.Rel | Component.PairFn,
  ) {
    if (typeof rel === "function") {
      rel = rel()
    }
    return assert_exists(
      this.get_exclusive_relative_opt(entity, rel),
      err_missing_entity_exclusive,
    )
  }

  is_alive(entity: Entity.t) {
    return this.#entity_registry.is_alive(entity)
  }

  array(component_id: number) {
    let array = (this.#entity_data[component_id] ??= [])
    return array
  }

  single(ref: Component.Ref): Entity.t {
    let node = this.graph.find_or_create_node_by_component(ref)
    // Fast path for singleton components
    if (node.entities.size() > 0) {
      return node.entities.at(0)
    }
    let entity: Entity.t | undefined
    node.traverse_right(visited_node => {
      // TODO: implement a better way to terminate traversal
      if (entity !== undefined) {
        return false
      }
      if (visited_node.entities.size() > 0) {
        entity = visited_node.entities.at(0)
        return false
      }
    })
    return assert_exists(entity, err_missing_entity_single)
  }

  with<U extends Component.Tag>(tag: U): EntityBuilder.EntityBuilder
  with<U extends Component.Ref>(
    ref: U,
    value: Component.ValueOf<U>,
  ): EntityBuilder.EntityBuilder
  with<U extends Component.RefFactory>(ref: U): EntityBuilder.EntityBuilder
  with<U extends Component.Pair>(component: U): EntityBuilder.EntityBuilder
  with(
    component: Component.Tag | Component.Ref | Component.Pair,
    value?: unknown,
  ) {
    let entity_builder = EntityBuilder.make(this)
    return Component.is_ref(component)
      ? entity_builder.with(component, value ?? component.init?.())
      : entity_builder.with(component)
  }

  for_each<U extends unknown[]>(
    query: Selector.t<U>,
    iteratee: Query.ForEachIteratee<U>,
  ) {
    let resolved_query = this.#resolve_query(query)
    resolved_query.for_each(iteratee)
    return this
  }

  add_effect<const U extends Effect.Term[]>(effect: Effect.t<U>) {
    let components = effect.terms.map(c => (typeof c === "function" ? c() : c))
    let type = Type.make(components)
    let node = this.graph.find_or_create_node_by_type(type)
    node.add_listener(effect, true)
    effect.world = this
  }
}
export type t = World

export let make = (): t => {
  return new World()
}
