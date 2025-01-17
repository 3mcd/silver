import {ref} from "#component"

class Client {
  t_time_sync = 0
}

export type T = Client

export let make = () => new Client()

export let res = ref<Client>()
