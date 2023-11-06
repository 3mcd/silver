import * as Type from "../data/type"

export enum Kind {
  Is,
  Not,
  Changed,
  In,
  Out,
}

export class Filter {
  kind
  type
  constructor(kind: Kind, type: Type.T) {
    this.kind = kind
    this.type = type
  }
}
export type T = Filter

export const Is = (type: Type.T) => new Filter(Kind.Is, type)
export const Not = (type: Type.T) => new Filter(Kind.Not, type)
export const Changed = (type: Type.T) => new Filter(Kind.Changed, type)
export const In = (type: Type.T = Type.make()) => new Filter(Kind.In, type)
export const Out = (type: Type.T = Type.make()) => new Filter(Kind.Out, type)
