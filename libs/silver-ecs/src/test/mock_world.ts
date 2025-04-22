import {assert_exists} from "#assert"
import * as Component from "#component"
import * as Entity from "#entity"
import {hash_words} from "#hash"
import * as SparseMap from "#sparse_map"
import * as Type from "#type"
import * as World from "#world"

type MockNode = {
  id: number
  type: {
    vec: Component.t[]
    vec_hash: number
    refs: Component.Ref[]
  }
}

export let mock_world = () => {
  let entities = new Map<Entity.t, Set<Component.t>>()
  let resources = new Map<Component.Ref, unknown>()

  let node_id = 0
  let node_ids = new Map<number, number>()
  let nodes_by_id = SparseMap.make<MockNode>()

  let get_node = (vec: Component.t[]) => {
    let vec_hash = hash_words(vec.map(c => c.id))
    let id = node_ids.get(vec_hash)
    if (id === undefined) {
      id = node_id++
      node_ids.set(vec_hash, id)
    }
    let node = nodes_by_id.get(id)
    if (node === undefined) {
      node = {id, type: {vec, vec_hash, refs: vec.filter(Component.is_ref)}}
      nodes_by_id.set(id, node)
    }
    return node
  }

  let stores = new Map<number, unknown[]>()

  let get_store = (component_id: number) => {
    let store = stores.get(component_id)
    if (store === undefined) {
      store = []
      stores.set(component_id, store)
    }
    return store
  }

  return {
    graph: {
      nodes_by_id,
    },
    set_resource(res: Component.Ref, value: unknown) {
      resources.set(res, value)
      return this
    },
    get_resource(res: Component.Ref) {
      return assert_exists(resources.get(res))
    },
    get_resource_opt(res: Component.Ref) {
      return resources.get(res)
    },
    get(entity: Entity.t, component: Component.t) {
      return get_store(component.id)[entity]
    },
    set(entity: Entity.t, component: Component.t, value: unknown) {
      get_store(component.id)[entity] = value
      let set = entities.get(entity)
      if (set === undefined) {
        set = new Set()
        entities.set(entity, set)
      }
      set.add(component)
      return this
    },
    has(entity: Entity.t, component: Component.t) {
      let set = entities.get(entity)
      if (set === undefined) {
        return false
      }
      return set.has(component)
    },
    add(entity: Entity.t, component: Component.t, value = null) {
      if (value !== undefined) {
        this.set(entity, component, value)
      } else {
        let set = entities.get(entity)
        if (set === undefined) {
          set = new Set()
          entities.set(entity, set)
        }
        set.add(component)
      }
      return this
    },
    get_entity_node(entity: Entity.t) {
      let set = entities.get(entity)
      if (set === undefined) {
        throw new Error(`entity ${entity} does not exist`)
      }
      return get_node(Array.from(set.keys()))
    },
    store(component_id: number) {
      return get_store(component_id)
    },
    build() {
      return this as unknown as World.t
    },
    is_alive(entity: Entity.t) {
      return entities.has(entity)
    },
    reserve(entity: Entity.t, type: Type.t, values: unknown[]) {
      for (let i = 0; i < type.vec.length; i++) {
        let component = type.vec[i]
        if (Component.is_ref(component)) {
          let value = values[component.id]
          this.set(entity, component, value)
        } else {
          this.set(entity, component, null)
        }
      }
    },
  }
}
