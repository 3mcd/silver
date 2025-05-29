import * as Component from "./component.ts"
import * as Node from "./node.ts"
import * as Selector from "./selector.ts"
import * as Type from "./type.ts"
import * as World from "./world.ts"

export type ForEachIteratee<U extends unknown[]> = (...value: U) => void
export type ForEach<U extends unknown[]> = (
  iteratee: ForEachIteratee<U>,
) => void

let build_for_each_join = (query: t, join_index: number) => {
  let i = `i${join_index}` // current node index
  let j = `j${join_index}` // current join index
  let q = `q${join_index}` // current join
  let n = `n${join_index}` // current node
  let exp = ""
  exp += `for(let ${i}=0;${i}<${q}.nodes.length;${i}++){`
  exp += `let ${n}=${q}.nodes[${i}];`
  if (join_index > 0) {
    exp += `let r=${n}.rel_maps[${q}.join_on.id],`
    exp += `rt=r.a_to_b[e${join_index - 1}]?.dense;`
    exp += "if(rt===undefined)continue;"
    exp += `for(let ${j}=0;${j}<rt.length;${j}++){`
    exp += `let e${join_index}=rt[${j}];`
  } else {
    exp += `for(let ${j}=0;${j}<${n}.entities.size();${j}++){`
    exp += `let e${join_index}=${n}.entities.at(${j});`
  }
  if (join_index === query.joins.length - 1) {
    exp += "let r=$("
    let fetch: string[] = []
    for (let join_index = 0; join_index < query.joins.length; join_index++) {
      let join = query.joins[join_index]
      let ref_index = 0
      for (let i = 0; i < join.terms.length; i++) {
        let term = join.terms[i]
        if (term === "entity") {
          fetch.push(`e${join_index}`)
        } else if (typeof term === "object" && Component.is_ref(term)) {
          fetch.push(`w${join_index}${ref_index++}[e${join_index}]`)
        }
      }
    }
    exp += fetch.join(",")
    exp += ");"
    exp += `if(r===false)return;`
  } else {
    exp += build_for_each_join(query, join_index + 1)
  }
  exp += "}"
  exp += "}"
  return exp
}

function compile_for_each<U extends unknown[]>(
  query: t<U>,
  world: World.t,
): ForEach<U>
function compile_for_each<U extends unknown[]>(query: t<U>, world: World.t) {
  let body = ""
  body += query.joins
    .map((_, join_index) => `let q${join_index}=Q.joins[${join_index}];`)
    .join("")
  body += query.joins
    .map((join, join_index) =>
      join.terms
        .filter(t => typeof t === "object")
        .filter(Component.is_ref)
        .map(
          (ref, ref_index) =>
            `let w${join_index}${ref_index}=W.array(${ref.id});`,
        )
        .join(""),
    )
    .join("")
  body += "return $=>{"
  body += build_for_each_join(query, 0)
  body += "}"
  return new Function("Q", "W", body)(query, world)
}

class Query<U extends unknown[] = unknown[]> {
  for_each
  builder
  joins

  constructor(builder: Selector.t<U>, joins: Join[], world: World.t) {
    this.builder = builder
    this.joins = joins
    this.for_each = compile_for_each(this, world)
  }
}
export type t<U extends unknown[] = unknown[]> = Query<U>

class Join implements Node.Listener {
  join_on
  nodes
  terms

  constructor(terms: Selector.Term[], join_on?: Component.t) {
    this.join_on = join_on
    this.nodes = [] as Node.t[]
    this.terms = terms
  }

  on_node_created(node: Node.t): void {
    this.nodes.push(node)
  }
}

let init_query_joins = (
  query_builder_node: Selector.t,
  world: World.t,
  joins: Join[] = [],
) => {
  let join = new Join(query_builder_node.terms, query_builder_node.join_on)
  let node = world.graph.find_or_create_node_by_type(
    Type.make(query_builder_node.terms.filter(t => typeof t === "object")),
  )
  node.add_listener(join, true)
  joins.push(join)
  query_builder_node.joins.each_value(join_selector => {
    init_query_joins(join_selector, world, joins)
  })
  return joins
}

export let make = <U extends unknown[]>(
  query_builder: Selector.t<U>,
  world: World.t,
): t<U> => {
  let query_joins = init_query_joins(query_builder, world)
  let query = new Query(query_builder, query_joins, world)
  return query
}
