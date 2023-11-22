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
  Position,
  Rotation,
  Scale,
} from "silver-lib"

export class Aliases {
  aliases

  constructor() {
    this.aliases = [] as string[]
    this.set(Position, "Position")
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
      let rid = parseHi(component.id)
      let eid = parseLo(component.id)
      return `${this.aliases[Hash.word(0, rid)]}:${eid}`
    }
    return this.aliases[Hash.word(0, component.id)]
  }
}

export let aliasContext = createContext<Aliases>(null!)

export let makeDebugAliases = () => new Aliases()
