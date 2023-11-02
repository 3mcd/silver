import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Hash from "../hash"

export enum Kind {
  Not,
  Changed,
  In,
  Out,
}

const not_component_id = Component.make_component_id()
const changed_component_id = Component.make_component_id()
const in_component_id = Component.make_component_id()
const out_component_id = Component.make_component_id()

export class Filter {
  hash
  kind
  type
  constructor(hash: number, kind: Kind, type: Type.T) {
    this.hash = hash
    this.kind = kind
    this.type = type
  }
}
export type T = Filter

export const Not = (type: Type.T) => {
  return new Filter(Hash.words([type.hash, not_component_id]), Kind.Not, type)
}

export const Changed = (type: Type.T) => {
  return new Filter(
    Hash.words([type.hash, changed_component_id]),
    Kind.Changed,
    type,
  )
}

export const In = (type: Type.T = Type.make()) => {
  return new Filter(Hash.words([type.hash, in_component_id]), Kind.In, type)
}

export const Out = (type: Type.T = Type.make()) => {
  return new Filter(Hash.words([type.hash, out_component_id]), Kind.Out, type)
}
