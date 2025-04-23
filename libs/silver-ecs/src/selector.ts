import * as Entity from "#entity"
import * as Component from "./component.ts"
import * as SparseMap from "./sparse_map.ts"

export type Term =
  | Component.Ref
  | Component.Tag
  | Component.Rel
  | Component.RelInverse
  | Component.Pair
  | Component.PairFn
  | "entity"

type WithRef<T extends unknown[], U> = U extends Component.Ref<infer V>
  ? Selector<[...T, V]>
  : never

type Join<U extends unknown[]> = (query_builder: Selector<[]>) => Selector<U>

export class Selector<T extends unknown[] = unknown[]> {
  /** @internal */
  terms
  /** @internal */
  joins
  /** @internal */
  join_on

  constructor(
    terms: Term[] = [],
    join_on: Component.t | undefined = undefined,
    joins = SparseMap.make<Selector>(),
  ) {
    this.terms = terms
    this.joins = joins
    this.join_on = join_on
  }

  with<U extends Component.Ref>(ref: U): WithRef<T, U>
  with<U extends Component.Tag>(tag: U): this
  with(rel: Component.Rel): this
  with<U extends unknown[]>(
    rel: Component.Rel,
    join: Join<U>,
  ): Selector<[...T, ...U]>
  with<U extends unknown[]>(pair_fn: Component.PairFn): Selector<[...T, ...U]>
  with<U extends unknown[]>(
    pair_fn: Component.PairFn,
    join: Join<U>,
  ): Selector<[...T, ...U]>
  with(pair: Component.Pair): this
  with(
    component: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
  ): Selector
  with(entity: "entity"): Selector<[...T, Entity.t]>
  with(term: Term, join?: Join<unknown[]>) {
    if (term instanceof Function) {
      term = term()
    }
    let terms = [...this.terms, term]
    let joins = this.joins.clone()
    if (
      typeof term === "object" &&
      Component.is_rel(term) &&
      join !== undefined
    ) {
      let selector = new Selector([term.inverse], term.inverse)
      joins.set(term.id, join(selector))
    }
    return new Selector(terms, this.join_on, joins)
  }
}
export type t<U extends unknown[] = unknown[]> = Selector<U>

export function make(): Selector<[]>
export function make<U extends Component.Ref>(ref: U): WithRef<[], U>
export function make(
  component: Component.Tag | Component.Rel | Component.PairFn,
): Selector<[]>
export function make(
  component?: Component.Ref | Component.Tag | Component.Rel | Component.PairFn,
): Selector<[]> {
  return component === undefined
    ? new Selector()
    : new Selector().with(component)
}
