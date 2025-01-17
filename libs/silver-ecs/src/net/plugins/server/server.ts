class Server {
  next_id
  free_ids

  constructor() {
    this.next_id = 1
    this.free_ids = [] as number[]
  }
}

export type T = Server

export let make = () => {
  return new Server()
}

export let make_client_id = (server: Server) => {
  return server.free_ids.length > 0 ? server.free_ids.pop()! : server.next_id++
}

export let free_client_id = (server: Server, client_id: number) => {
  server.free_ids.push(client_id)
}
