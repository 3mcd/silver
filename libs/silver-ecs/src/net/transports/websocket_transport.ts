import {Transport} from "../transport"
import * as Buffer from "../../buffer"

class WebSocketTransport implements Transport {
  #ws
  #inbox

  constructor(ws: WebSocket) {
    this.#ws = ws
    this.#inbox = [] as ArrayBuffer[]
    this.#ws.addEventListener("message", event => {
      this.#inbox.push(event.data as ArrayBuffer)
    })
  }

  send(buffer: Buffer.T) {
    this.#ws.send(Buffer.end(buffer))
  }

  recv() {
    if (this.#inbox.length === 0) {
      return undefined
    }
    return Buffer.make(this.#inbox.shift()!)
  }
}

export let make = (ws: WebSocket) => {
  return new WebSocketTransport(ws)
}
