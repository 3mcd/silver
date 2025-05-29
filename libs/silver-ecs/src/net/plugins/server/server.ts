class Server {
  next_id
  free_ids

  constructor() {
    this.next_id = 2
    this.free_ids = [] as number[]
  }

  make_client_id() {
    return this.free_ids.length > 0 ? this.free_ids.pop()! : this.next_id++
  }

  free_client_id(client_id: number) {
    this.free_ids.push(client_id)
  }
}

export type t = Server

export let make = () => {
  return new Server()
}
