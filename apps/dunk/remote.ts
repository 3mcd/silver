import {Remote} from "silver-ecs/net"

export class WebTransportRemote implements Remote {
  #writer
  #reader
  #inbox
  #closed = false

  constructor(session: WebTransport) {
    this.#inbox = [] as Uint8Array[]
    this.#writer = session.datagrams.writable.getWriter()
    this.#reader = session.datagrams.readable.getReader()
    this.#listen()
    session.closed.then(() => {
      this.#closed = true
    })
  }

  async #listen() {
    try {
      while (true) {
        const {value, done} = await this.#reader.read()
        if (done) {
          break
        }
        this.#inbox.push(value)
      }
    } catch (e) {
      console.error(e)
    }
  }

  send(data: Uint8Array) {
    if (this.#closed) {
      return
    }
    this.#writer.write(data)
  }

  recv() {
    return this.#inbox.shift()!
  }
}
