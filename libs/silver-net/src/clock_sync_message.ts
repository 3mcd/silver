import {OffsetSample} from "./clock_sync"
import {
  CLOCK_SYNC_REQUEST_MESSAGE_TYPE,
  CLOCK_SYNC_RESPONSE_MESSAGE_TYPE,
} from "./protocol"

export let REQUEST_MESSAGE_SIZE = 9
export let RESPONSE_MESSAGE_SIZE = 17

export let encode_request = (
  view: DataView,
  offset: number,
  client_time: number,
): void => {
  view.setUint8(offset, CLOCK_SYNC_REQUEST_MESSAGE_TYPE)
  offset += Uint8Array.BYTES_PER_ELEMENT
  view.setFloat64(offset, client_time, true)
}

export let decode_request = (view: DataView, offset: number): number => {
  offset += Uint8Array.BYTES_PER_ELEMENT
  return view.getFloat64(offset, true)
}

export let encode_response = (
  view: DataView,
  offset: number,
  client_time: number,
  server_time: number,
): void => {
  view.setUint8(offset, CLOCK_SYNC_RESPONSE_MESSAGE_TYPE)
  offset += Uint8Array.BYTES_PER_ELEMENT
  view.setFloat64(offset, client_time, true)
  offset += Float64Array.BYTES_PER_ELEMENT
  view.setFloat64(offset, server_time, true)
}

export let decode_response = (
  view: DataView,
  offset: number,
  sample: OffsetSample,
): void => {
  offset += Uint8Array.BYTES_PER_ELEMENT
  sample.client_time = view.getFloat64(offset, true)
  offset += Float64Array.BYTES_PER_ELEMENT
  sample.server_time = view.getFloat64(offset, true)
}
