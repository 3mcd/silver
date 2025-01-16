import * as Buffer from "../buffer"
import {ref} from "../component"

export type Transport = {
  send: (buffer: Buffer.T) => void
  recv: () => Buffer.T | undefined
}

export let Transport = ref<Transport>()
