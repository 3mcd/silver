import {createContext} from "react"
import * as S from "silver-ecs"
import {
  AngularVelocity,
  DebugHighlighted,
  DebugSelected,
  LinearVelocity,
  Name,
  Position,
  Rotation,
  Scale,
} from "silver-lib"

export class Aliases {
  aliases

  constructor() {
    this.aliases = [] as string[]
    this.set(Name, "Name")
      .set(Position, "Position")
      .set(Rotation, "Rotation")
      .set(LinearVelocity, "LinearVelocity")
      .set(AngularVelocity, "AngularVelocity")
      .set(Scale, "Scale")
      .set(DebugHighlighted, "DebugHighlighted")
      .set(DebugSelected, "DebugSelected")
  }

  set(type: S.Type, alias: string) {
    this.aliases[type.hash] = alias
    return this
  }

  getComponentAlias(component: S.Component) {
    if (S.isRelationship(component)) {
      let relationId = S.parseHi(component.id)
      let entityId = S.parseLo(component.id)
      return `${this.aliases[S.Hash.words([relationId])]}:${entityId}`
    }
    return this.aliases[S.Hash.words([component.id])] ?? component.id.toString()
  }
}

export let aliasContext = createContext<Aliases>(null!)

export let makeDebugAliases = () => {
  return new Aliases()
}
