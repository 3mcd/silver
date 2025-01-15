class Client {
  #inbound = []
  #outbound = []

  send() {}

  recv() {}

  drain_inbound(iteratee: (message: ArrayBuffer) => void) {
    let message: ArrayBuffer | undefined
    while ((message = this.#inbound.pop()) !== undefined) {
      iteratee(message)
    }
  }

  drain_outbound(iteratee: (message: ArrayBuffer) => void) {
    let message: ArrayBuffer | undefined
    while ((message = this.#outbound.pop()) !== undefined) {
      iteratee(message)
    }
  }
}

export type T = Client

export let make = () => new Client()
