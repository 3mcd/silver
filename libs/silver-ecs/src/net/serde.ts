import {assert_exists} from "#assert"
import * as Component from "#component"
import * as RefEncoding from "./ref_encoding.ts"

class Serde {
  #by_iso
  #to_iso
  #ref_encodings

  constructor() {
    this.#by_iso = [] as Component.t[]
    this.#to_iso = [] as number[]
    this.#ref_encodings = [] as RefEncoding.t[]
  }

  add(component: Component.t) {
    let iso = this.#by_iso.length
    this.#to_iso[component.id] = iso
    this.#by_iso.push(component)
    if (Component.is_ref(component)) {
      this.#ref_encodings[iso] = RefEncoding.make(component)
    }
    return this
  }

  has(component: Component.t) {
    return this.#to_iso[component.id] !== undefined
  }

  from_iso(iso: number) {
    return assert_exists(this.#by_iso[iso])
  }

  to_iso(component: Component.t) {
    return this.#to_iso[component.id]
  }

  encoding_from_ref_id(ref_id: number) {
    let iso = this.#to_iso[ref_id]
    return assert_exists(this.#ref_encodings[iso])
  }
}

export type t = Serde

export let make = () => {
  return new Serde()
}

export let res = Component.ref<t>()
