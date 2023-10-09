export declare const brand: unique symbol
export type Brand<T> = {readonly [brand]: T}

export type Opaque<T, U> = T & Brand<U>

export type ExcludeFromTuple<T extends readonly any[], E> = T extends [
  infer F,
  ...infer R,
]
  ? [F] extends [E]
    ? ExcludeFromTuple<R, E>
    : [F, ...ExcludeFromTuple<R, E>]
  : []
