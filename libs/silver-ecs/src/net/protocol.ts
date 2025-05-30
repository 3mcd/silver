import * as Buffer from "#buffer"
import {MessageType} from "./message_type.ts"

export {MessageType}

export let read_message_type = (buffer: Buffer.t) => {
  return buffer.read_u8()
}

export let init_identity = () => {
  let buffer = Buffer.make(5)
  buffer.write_u8(MessageType.Identity)
  return buffer
}

export let write_identity = (buffer: Buffer.t, id: number) => {
  buffer.write_u32(id)
}

export let read_identity = (buffer: Buffer.t) => {
  return buffer.read_u32()
}

export let init_time_sync_request = () => {
  let buffer = Buffer.make(9)
  buffer.write_u8(MessageType.TimeSyncRequest)
  return buffer
}

export let write_time_sync_request = (buffer: Buffer.t, t_mono: number) => {
  buffer.write_f64(t_mono)
}

export let read_time_sync_request = (buffer: Buffer.t) => {
  return buffer.read_f64()
}

export let init_time_sync_response = () => {
  let buffer = Buffer.make(17)
  buffer.write_u8(MessageType.TimeSyncResponse)
  return buffer
}

export let write_time_sync_response = (
  buffer: Buffer.t,
  t_origin: number,
  t_remote: number,
) => {
  buffer.write_f64(t_origin)
  buffer.write_f64(t_remote)
}

export let read_time_sync_response = (
  buffer: Buffer.t,
  out: [number, number],
) => {
  out[0] = buffer.read_f64()
  out[1] = buffer.read_f64()
}

export {
  decode_interest,
  encode_interest,
  init_interest,
} from "./interest/interest_message.ts"
