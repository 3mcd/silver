import * as World from "../world"
import * as Buffer from "../buffer"
import * as Assert from "../assert"

class Message<U> {
  #type
  #encode
  #decode
  #init

  constructor(
    type: number,
    encode: (buffer: Buffer.T, payload: any) => void,
    decode: (buffer: Buffer.T, world: World.T) => any,
    init = 0,
  ) {
    this.#type = type
    this.#encode = encode
    this.#decode = decode
    this.#init = init
  }

  encode(buffer: Buffer.T, payload: U) {
    Buffer.grow(buffer, 1 + this.#init)
    Buffer.write_u8(buffer, this.#type)
    this.#encode(buffer, payload)
  }

  decode(buffer: Buffer.T, world: World.T) {
    Assert.assert(Buffer.read_u8(buffer) === this.#type)
    return this.#decode(buffer, world)
  }
}

export let make = <U>(
  type: number,
  encode: Message<U>["encode"],
  decode: Message<U>["decode"],
  init?: number,
): Message<U> => new Message(type, encode, decode, init)

export let type = (buffer: Buffer.T) => Buffer.peek_u8(buffer)
