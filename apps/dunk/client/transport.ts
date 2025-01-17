import {Transport} from "silver-ecs/net"

export class WebTransportTransport implements Transport {
  #writer
  #reader
  #inbox

  constructor(session: WebTransport) {
    this.#inbox = [] as Uint8Array[]
    this.#writer = session.datagrams.writable.getWriter()
    this.#reader = session.datagrams.readable.getReader()
    this.#listen()
  }

  async #listen() {
    try {
      while (true) {
        const {value, done} = await this.#reader.read()
        if (done) {
          break
        }
        console.log(value)
        this.#inbox.push(value)
      }
    } catch (e) {
      console.error(e)
    }
  }

  send(data: Uint8Array) {
    this.#writer.write(data)
  }

  recv() {
    return this.#inbox.shift()!
  }
}
