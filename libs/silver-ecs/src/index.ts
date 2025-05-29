/**
 * A trait given to an entity.
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
 * A function that implements entity behavior.
 */
export * as System from "./app/system.ts"

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
export * as Selector from "./selector.ts"

export * as World from "./world.ts"

export * as Data from "./schema.ts"

export * as Entity from "./entity.ts"
