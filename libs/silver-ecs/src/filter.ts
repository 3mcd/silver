import * as Type from "./sig"

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

export let Is = (type: Type.T) => {
  return new Filter(Kind.Is, type)
}

export let Not = (type: Type.T) => {
  return new Filter(Kind.Not, type)
}

export let Changed = (type: Type.T) => {
  return new Filter(Kind.Changed, type)
}

export let In = (type: Type.T = Type.make()) => {
  return new Filter(Kind.In, type)
}

export let Out = (type: Type.T = Type.make()) => {
  return new Filter(Kind.Out, type)
}
