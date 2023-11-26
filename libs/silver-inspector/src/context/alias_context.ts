import {createContext} from "react"
import {
  Component,
  Hash,
  Type,
  isRelationship,
  parseHi,
  parseLo,
} from "silver-ecs"
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

  set(type: Type, alias: string) {
    this.aliases[type.hash] = alias
    return this
  }

  getComponentAlias(component: Component) {
    if (isRelationship(component)) {
      let relationId = parseHi(component.id)
      let entityId = parseLo(component.id)
      return `${this.aliases[Hash.words([relationId])]}:${entityId}`
    }
    return this.aliases[Hash.words([component.id])]
  }
}

export let aliasContext = createContext<Aliases>(null!)

export let makeDebugAliases = () => new Aliases()
