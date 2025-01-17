import {ref} from "#component"

export type Transport = {
  send: (buffer: Uint8Array) => void
  recv: () => Uint8Array | undefined
}

export let Transport = ref<Transport>()
