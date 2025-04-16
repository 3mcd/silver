import * as Component from "./component.ts"
import * as SparseMap from "./sparse_map.ts"

type WithRef<T extends unknown[], U> = U extends Component.Ref<infer V>
  ? QueryBuilder<[...T, V]>
  : never

type Join<U extends unknown[]> = (
  query_builder: QueryBuilder<[]>,
) => QueryBuilder<U>

export class QueryBuilder<T extends unknown[] = unknown[]> {
  /** @internal */
  terms
  /** @internal */
  joins
  /** @internal */
  join_on

  constructor(join_on?: Component.t) {
    this.terms = join_on ? [join_on] : []
    this.joins = SparseMap.make<QueryBuilder>()
    this.join_on = join_on
  }

  read<U extends Component.Ref>(ref: U): WithRef<T, U>
  read<U extends Component.Tag>(tag: U): this
  read(rel: Component.Rel): this
  read<U extends unknown[]>(
    rel: Component.Rel,
    join: Join<U>,
  ): QueryBuilder<[...T, ...U]>
  read<U extends unknown[]>(
    pair_fn: Component.PairFn,
  ): QueryBuilder<[...T, ...U]>
  read<U extends unknown[]>(
    pair_fn: Component.PairFn,
    join: Join<U>,
  ): QueryBuilder<[...T, ...U]>
  read(
    component: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
  ): QueryBuilder
  read(
    component: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
    join?: Join<unknown[]>,
  ) {
    if (component instanceof Function) {
      component = component()
    }
    if (Component.is_rel(component) && join !== undefined) {
      this.joins.set(component.id, join(new QueryBuilder(component.inverse)))
    }
    this.terms.push(component)
    return this
  }
}
export type t<U extends unknown[] = unknown[]> = QueryBuilder<U>

export function make(): QueryBuilder<[]>
export function make<U extends Component.Ref>(ref: U): WithRef<[], U>
export function make(
  component: Component.Tag | Component.Rel | Component.PairFn,
): QueryBuilder<[]>
export function make(
  component?: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
): QueryBuilder<[]> {
  return component === undefined
    ? new QueryBuilder()
    : new QueryBuilder().read(component)
}
