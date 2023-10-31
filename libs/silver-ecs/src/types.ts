export declare const brand: unique symbol
export type Brand<U> = {readonly [brand]: U}

export type Opaque<U, V> = U & Brand<V>

export type ExcludeFromTuple<U extends readonly any[], V> = U extends [
  infer Head,
  ...infer Tail,
]
  ? [Head] extends [V]
    ? ExcludeFromTuple<Tail, V>
    : [Head, ...ExcludeFromTuple<Tail, V>]
  : []
