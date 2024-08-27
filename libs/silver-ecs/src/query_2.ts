import * as World from "./world"
import * as Component from "./component"
import * as Entity from "./entity"
import * as Graph from "./graph"
import * as Node from "./node"
import * as QueryBuilder from "./query_builder"
import * as SparseMap from "./sparse_map"
import * as Type from "./type"

let build_for_each_join = (query: T, join_index: number) => {
  let i = `i${join_index}`
  let j = `j${join_index}`
  let q = `q${join_index}`
  let n = `n${join_index}`
  let exp = ""
  exp += `for(let ${i}=0;${i}<${q}.nodes.length;${i}++){`
  exp += `let ${n}=${q}.nodes[${i}];`
  if (join_index > 0) {
    exp += `let r=${n}.rel_maps[${q}.on.id],`
    exp += `rt=r.a_to_b[e${join_index - 1}]?.dense;`
    exp += `if(rt===undefined)continue;`
    exp += `for(let ${j}=0;${j}<rt.length;${j}++){`
    exp += `let e${join_index}=rt[${j}];`
  } else {
    exp += `for(let ${j}=0;${j}<${n}.entities.dense.length;${j}++){`
    exp += `let e${join_index}=${n}.entities.dense[${j}];`
  }
  if (join_index === query.joins.length - 1) {
    exp += "$("
    for (let join_index = 0; join_index < query.joins.length; join_index++) {
      let join = query.joins[join_index]
      exp += join.type.def
        .filter(Component.is_ref)
        .map((_, ref_index) => `w${join_index}${ref_index}[e${join_index}],`)
    }
    exp += ")"
  } else {
    exp += build_for_each_join(query, join_index + 1)
  }
  exp += "}"
  exp += "}"
  return exp
}

let compile_for_each = (query: T, world: World.T) => {
  let body = ""
  body += query.joins
    .map((_, join_index) => `let q${join_index}=Q.joins[${join_index}];`)
    .join("")
  body += query.joins
    .map((join, join_index) =>
      join.type.def
        .filter(Component.is_ref)
        .map(
          (ref, ref_index) =>
            `let w${join_index}${ref_index}=W.store(${ref.id});`,
        )
        .join(""),
    )
    .join("")
  body += "return $=>{"
  body += build_for_each_join(query, 0)
  body += "}"
  return new Function("Q", "W", body)(query, world)
}

export type ForEachIteratee<U extends unknown[]> = (
  ...args: [...value: U, entity: Entity.T]
) => void

class Query<U extends unknown[] = unknown[]> {
  #for_each: any
  builder
  joins

  constructor(builder: QueryBuilder.T<U>) {
    this.builder = builder
    this.joins = [] as Join[]
  }

  compile(world: World.T) {
    this.#for_each = compile_for_each(this, world)
  }

  for_each(iteratee: ForEachIteratee<U>) {
    this.#for_each(iteratee)
  }
}
export type T<U extends unknown[] = unknown[]> = Query<U>

class Join implements Node.Listener {
  join_on
  nodes
  type

  constructor(type: Type.T, join_on?: Component.T) {
    this.join_on = join_on
    this.nodes = [] as Node.T[]
    this.type = type
  }

  on_node_created(node: Node.T): void {
    this.nodes.push(node)
  }
}

let init_query_listeners = (
  query_builder_node: QueryBuilder.T,
  query: T,
  world: World.T,
) => {
  let node = Graph.find_or_create_node_by_type(
    world.graph,
    query_builder_node.type,
  )
  let join = new Join(query_builder_node.type, query_builder_node.join_on)
  Node.add_listener(node, join, true)
  query.joins.push(join)
  SparseMap.each_value(query_builder_node.joins, query_builder_inner => {
    init_query_listeners(query_builder_inner, query, world)
  })
}

export let make = <U extends unknown[]>(
  query_builder: QueryBuilder.T<U>,
  world: World.T,
): T<U> => {
  let query = new Query(query_builder)
  init_query_listeners(query_builder, query, world)
  query.compile(world)
  return query
}
