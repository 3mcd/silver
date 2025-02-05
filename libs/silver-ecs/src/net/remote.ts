import {ref} from "#component"

export type Remote = {
  send: (buffer: Uint8Array) => void
  recv: () => Uint8Array | undefined
}

export let Remote = ref<Remote>()
