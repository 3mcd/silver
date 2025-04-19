import {ref} from "#component"

class Client {
  t_last_time_sync = 0
}

export type t = Client

export let make = () => new Client()

export let res = ref<Client>()
