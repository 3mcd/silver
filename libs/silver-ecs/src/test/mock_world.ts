import * as Entity from "#entity"
import {assert_exists} from "#assert"
import * as Component from "#component"
import * as World from "#world"
import * as SparseMap from "#sparse_map"
import {hash_words} from "#hash"

type MockNode = {
  id: number
  type: {
    vec: Component.T[]
    vec_hash: number
    refs: Component.Ref[]
  }
}

export let mock_world = () => {
  let resources = new Map<Component.Ref, unknown>()
  let entities = new Map<number, Map<Component.T, unknown>>()

  let node_id = 0
  let node_ids = new Map<number, number>()
  let nodes_by_id = SparseMap.make<MockNode>()

  let get_node = (vec: Component.T[]) => {
    let vec_hash = hash_words(vec.map(c => c.id))
    let id = node_ids.get(vec_hash)
    if (id === undefined) {
      id = node_id++
      node_ids.set(vec_hash, id)
    }
    let node = SparseMap.get(nodes_by_id, id)
    if (node === undefined) {
      node = {id, type: {vec, vec_hash, refs: vec.filter(Component.is_ref)}}
      SparseMap.set(nodes_by_id, id, node)
    }
    return node
  }

  return {
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
    get(entity: Entity.T, component: Component.T) {
      return assert_exists(entities.get(entity)?.get(component))
    },
    set(entity: Entity.T, component: Component.T, value: unknown) {
      let entity_components = entities.get(entity) ?? new Map()
      entity_components.set(component, value)
      entities.set(entity, entity_components)
      return this
    },
    get_entity_node(entity: Entity.T) {
      let map = entities.get(entity)
      if (map === undefined) {
        throw new Error(`entity ${entity} does not exist`)
      }
      return get_node(Array.from(map.keys()))
    },
    graph: {
      nodes_by_id,
    },
    build() {
      return this as unknown as World.T
    },
  }
}
