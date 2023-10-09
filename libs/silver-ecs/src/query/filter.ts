import * as Component from "../data/component"
import * as Type from "../data/type"
import * as Hash from "../hash"

export enum Kind {
  Not,
  Changed,
  In,
  Out,
}

const notComponentId = Component.makeComponentId()
const changedComponentId = Component.makeComponentId()
const inComponentId = Component.makeComponentId()
const outComponentId = Component.makeComponentId()

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
  return new Filter(
    Hash.words([type.componentsHash, notComponentId]),
    Kind.Not,
    type,
  )
}

export const Changed = (type: Type.T) => {
  return new Filter(
    Hash.words([type.componentsHash, changedComponentId]),
    Kind.Changed,
    type,
  )
}

export const In = (type: Type.T) => {
  return new Filter(
    Hash.words([type.componentsHash, inComponentId]),
    Kind.In,
    type,
  )
}

export const Out = (type: Type.T) => {
  return new Filter(
    Hash.words([type.componentsHash, outComponentId]),
    Kind.Out,
    type,
  )
}
