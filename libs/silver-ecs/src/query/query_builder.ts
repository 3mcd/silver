// let draw_cells_query = query()
//   .with(CellOf, grid => grid.with(Grid, Position))
//   .with(Position)
//   .without(Disabled)
//
// let draw_cells: System<typeof draw_cells_query> = (grid, gridPos, cellPos) => {
//
// }
//
// let init_cells = effect(
//   CellOf,
//   create_cell_graphics,
//   delete_cell_graphics,
// )
//
//
// let plugin: Plugin = app => {
//   app
//    .add_system(draw_cells_query, draw_cells)
//    .add_effect(init_cells)
// }

import * as Component from "../data/component"
import * as Type from "../data/type"

type WithRef<
  T extends unknown[],
  U extends Component.Ref,
> = U extends Component.Ref<infer V> ? QueryBuilder<[...T, V]> : never

type WithJoin<T extends unknown[], U extends Join> = U extends Join
  ? QueryBuilder<[...T, ReturnType<U>]>
  : never

type Join = (query_builder: QueryBuilder) => QueryBuilder

class QueryBuilder<T extends unknown[] = unknown[]> {
  constructor() {}

  with<U extends Component.Ref>(ref: U): WithRef<T, U>
  with<U extends Component.Tag>(tag: U): this
  with(rel: Component.TagRelation): this
  with<V extends Join>(rel: Component.TagRelation, join: V): WithJoin<T, V>
  with<U extends Component.T>(component: U) {}

  without() {}

  make() {}
}

export let make = (): QueryBuilder<[]> => {
  return new QueryBuilder()
}

const ref = Component.make(0, Component.Kind.Ref) as Component.Ref<{}>
const rel = Component.make(0, Component.Kind.TagRelation)
const q = make().with(rel).with(ref)
