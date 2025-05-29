import {assert_exists} from "#assert"
import * as Component from "#component"
import * as Entity from "#entity"
import {hash_words} from "#hash"
import * as Node from "#node"
import * as SparseMap from "#sparse_map"
import * as SparseSet from "#sparse_set"
import * as Type from "#type"
import * as World from "#world"

export let mock_world = () => {
  class MockNode {
    id
    type
    listeners
    entities

    constructor(id: number, type: Type.t) {
      this.id = id
      this.type = type
      this.listeners = [] as Node.Listener[]
      this.entities = SparseSet.make<Entity.t>()
    }

    add_listener(
      listener: Node.Listener,
      emit_existing_nodes_as_created = false,
    ): void {
      this.listeners.push(listener)
      if (emit_existing_nodes_as_created) {
        emit_node(this)
      }
    }
  }

  let entities = new Map<Entity.t, Set<Component.t>>()
  let entity_nodes = new Map<Entity.t, MockNode>()
  let resources = new Map<Component.Ref, unknown>()

  let node_id = 0
  let node_ids = new Map<number, number>()
  let nodes_by_id = SparseMap.make<MockNode>()

  let emit_node = (node: MockNode) => {
    for (let n of nodes_by_id.values()) {
      if (n === node || node.type.is_superset(n.type)) {
        n.listeners.forEach(listener => {
          listener.on_node_created?.(node as unknown as Node.t)
        })
      }
    }
  }

  let get_node = (vec: Component.t[]) => {
    let vec_hash = hash_words(vec.map(c => c.id))
    let id = node_ids.get(vec_hash)
    if (id === undefined) {
      id = node_id++
      node_ids.set(vec_hash, id)
    }
    let node = nodes_by_id.get(id)
    if (node === undefined) {
      node = new MockNode(id, Type.make(vec))
      nodes_by_id.set(id, node)
      emit_node(node)
    }
    return node
  }

  let arrays = new Map<number, unknown[]>()
  let get_array = (component_id: number) => {
    let array = arrays.get(component_id)
    if (array === undefined) {
      array = []
      arrays.set(component_id, array)
    }
    return array
  }

  let update_entity_node = (entity: Entity.t) => {
    let set = entities.get(entity)
    if (set === undefined) {
      throw new Error(`entity ${entity} does not exist`)
    }
    let components = Array.from(set.values())
    let prev_node = entity_nodes.get(entity)
    let next_node = get_node(components)
    entity_nodes.set(entity, next_node)
    prev_node?.entities.delete(entity)
    next_node.entities.add(entity)
  }

  return {
    graph: {
      nodes_by_id,
      find_or_create_node_by_type(type: Type.t) {
        return get_node(type.vec)
      },
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
      return get_array(component.id)[entity]
    },
    set(entity: Entity.t, component: Component.t, value: unknown) {
      get_array(component.id)[entity] = value
      let set = entities.get(entity)
      if (set === undefined) {
        set = new Set()
        entities.set(entity, set)
      }
      set.add(component)
      update_entity_node(entity)
      return this
    },
    has(entity: Entity.t, component: Component.t) {
      let set = entities.get(entity)
      if (set === undefined) {
        return false
      }
      return set.has(component)
    },
    add(entity: Entity.t, component: Component.t, value: unknown = null) {
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
      update_entity_node(entity)
      return this
    },
    get_entity_node(entity: Entity.t) {
      let set = entities.get(entity)
      if (set === undefined) {
        throw new Error(`entity ${entity} does not exist`)
      }
      return get_node(Array.from(set.keys()))
    },
    array(component_id: number) {
      return get_array(component_id)
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
