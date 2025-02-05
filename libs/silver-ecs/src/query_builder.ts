import * as Component from "./component"
import * as SparseMap from "./sparse_map"

type WithRef<T extends unknown[], U> = U extends Component.Ref<infer V>
  ? QueryBuilderNode<[...T, V]>
  : never

type Join<U extends unknown[]> = (
  query_builder: QueryBuilderNode<[]>,
) => QueryBuilderNode<U>

class QueryBuilderNode<T extends unknown[] = unknown[]> {
  terms
  joins
  join_on

  constructor(join_on?: Component.T) {
    this.terms = join_on ? [join_on] : []
    this.joins = SparseMap.make<QueryBuilderNode>()
    this.join_on = join_on
  }

  with<U extends Component.Ref>(ref: U): WithRef<T, U>
  with<U extends Component.Tag>(tag: U): this
  with(rel: Component.Rel): this
  with<U extends unknown[]>(
    rel: Component.Rel,
    join: Join<U>,
  ): QueryBuilderNode<[...T, ...U]>
  with<U extends unknown[]>(
    pair_fn: Component.PairFn,
  ): QueryBuilderNode<[...T, ...U]>
  with<U extends unknown[]>(
    pair_fn: Component.PairFn,
    join: Join<U>,
  ): QueryBuilderNode<[...T, ...U]>
  with(
    component: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
  ): QueryBuilderNode
  with(
    component: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
    join?: Join<unknown[]>,
  ) {
    if (component instanceof Function) {
      component = component()
    }
    if (Component.is_rel(component) && join !== undefined) {
      SparseMap.set(
        this.joins,
        component.id,
        join(new QueryBuilderNode(component.inverse)),
      )
    }
    this.terms.push(component)
    return this
  }
}
export type T<U extends unknown[] = unknown[]> = QueryBuilderNode<U>

export function make(): QueryBuilderNode<[]>
export function make<U extends Component.Ref>(ref: U): WithRef<[], U>
export function make(
  component: Component.Tag | Component.Rel | Component.PairFn,
): QueryBuilderNode<[]>
export function make(
  component?: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
): QueryBuilderNode<[]> {
  return component === undefined
    ? new QueryBuilderNode()
    : new QueryBuilderNode().with(component)
}
