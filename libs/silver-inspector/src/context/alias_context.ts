import {createContext} from "react"
import {Component, Hash, Type, isRelationship, parseHi} from "silver-ecs"

export class Aliases {
  aliases

  constructor() {
    this.aliases = [] as string[]
  }

  set(type: Type, alias: string) {
    this.aliases[type.hash] = alias
    return this
  }

  get = (type: Type) => {
    return `(${
      this.aliases[type.hash] ??
      type.componentIds.map(id => this.aliases[Hash.word(0, id)]).join(",")
    })`
  }

  getComponent = (component: Component) => {
    if (isRelationship(component)) {
      let relationId = parseHi(component.id)
      let entityId = parseHi(component.id)
      return `${this.aliases[Hash.word(0, relationId)]}:${entityId}`
    }
    return this.aliases[Hash.word(0, component.id)]
  }
}

export let aliasContext = createContext<Aliases>(null!)

export let makeDebugAliases = () => new Aliases()
