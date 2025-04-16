/**
 * Traits given to entities to describe their data.
 */
export * as Component from "./component.ts"

/**
 * A collection of systems ordered relative to other ranges.
 */
export * as Range from "./app/range.ts"

/**
 * A pairing of a `World` to a declaratively ordered schedule of systems.
 */
export * as App from "./app/index.ts"

/**
 * An interface for reading and writing data to fixed or resizable `ArrayBuffer` instances.
 */
export * as Buffer from "./buffer.ts"

/**
 * A subscription that reacts to entity component signature changes.
 */
export * as Effect from "./effect.ts"

/**
 * A live collection of entities that match a given component signature.
 */
export * as Query from "./query_builder.ts"

export * as World from "./world.ts"

export {after, before, when} from "./app/index.ts"
export {ref, rel, tag} from "./component.ts"
export * from "./schema.ts"
export {make as type} from "./type.ts"
