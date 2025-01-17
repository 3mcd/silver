import {ref} from "../component"

export type Transport = {
  send: (buffer: ArrayBuffer) => void
  recv: () => ArrayBuffer | undefined
}

export let Transport = ref<Transport>()
