import {createContext} from "react"
import {Component, Hash, Type, is_relationship, parse_hi} from "silver-ecs"

export class Aliases {
  aliases

  constructor() {
    this.aliases = [] as string[]
  }

  set(type: Type, alias: string) {
    this.aliases[type.hash] = alias
    return this
  }

  get(type: Type) {
    return `(${
      this.aliases[type.hash] ??
      type.component_ids.map(id => this.aliases[Hash.word(0, id)]).join(",")
    })`
  }

  getComponent(component: Component) {
    if (is_relationship(component)) {
      let relation_id = parse_hi(component.id)
      let entity_id = parse_hi(component.id)
      return `${this.aliases[Hash.word(0, relation_id)]}:${entity_id}`
    }
    return this.aliases[Hash.word(0, component.id)]
  }
}

export let aliasContext = createContext<Aliases>(null!)

export let makeAliases = () => new Aliases()
