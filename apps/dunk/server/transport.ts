import {Transport} from "silver-ecs/net"
import {Socket} from "socket.io"

export class SocketIOTransport implements Transport {
  #socket
  #inbox

  constructor(socket: Socket) {
    this.#inbox = [] as ArrayBuffer[]
    this.#socket = socket
    this.#socket.on("message", (_, data: Buffer) => {
      let ab = new ArrayBuffer(data.byteLength)
      data.copy(new Uint8Array(ab))
      this.#inbox.push(ab)
    })
  }

  send(ab: ArrayBuffer) {
    this.#socket.send("message", ab)
  }

  recv() {
    return this.#inbox.shift()!
  }
}
