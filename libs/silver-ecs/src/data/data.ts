export const u8 = "u8"
export const u16 = "u16"
export const u32 = "u32"
export const i8 = "i8"
export const i16 = "i16"
export const i32 = "i32"
export const f32 = "f32"
export const f64 = "f64"
export const string = "string"

/**
 * A variable-length string.
 */
export type String = typeof string

/**
 * A numeric data type.
 */
export type Numeric =
  | typeof u8
  | typeof u16
  | typeof u32
  | typeof i8
  | typeof i16
  | typeof i32
  | typeof f32
  | typeof f64

/**
 * A scalar data type.
 */
export type Scalar = Numeric | String

/**
 * An object data type whose keys are strings and whose values are scalars or
 * (deeper-nested) objects.
 */
export interface Object {
  [key: string]: Schema
}

/**
 * A type that describes the shape of a component.
 */
export type Schema = Object | Scalar

/**
 * Express the value of a schema.
 *
 * @example <caption>Express the value of a scalar value.</caption>
 * type T = Express<"u8"> // number
 *
 * @example <caption>Express the value of an object schema.</caption>
 * type T = Express<{x: "f32", y: "f32"}> // {x: number, y: number}
 */
export type Express<T extends Schema> = T extends Object
  ? {
      [K in keyof T]: Express<T[K]>
    }
  : T extends Scalar
  ? T extends Numeric
    ? number
    : T extends String
    ? String
    : never
  : never

/**
 * Derive a schema from a type.
 *
 * @example <caption>Derive a schema from a scalar value.</caption>
 * type T = SchemaOf<number> // "u8" | "u16" ...
 *
 * @example <caption>Derive a schema from an object.</caption>
 * type T = SchemaOf<{x: number, y: number}> // {x: "u8" | "u16" ..., y: "u8" | "u16" ...}
 */
export type SchemaOf<T> = T extends object
  ? {[K in keyof T]: SchemaOf<T[K]>}
  : T extends number
  ? Numeric
  : T extends string
  ? String
  : never
