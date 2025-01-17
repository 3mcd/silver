import * as Buffer from "#buffer"

export enum MessageType {
  Identity = 0,
  TimeSyncRequest = 1,
  TimeSyncResponse = 2,
}

export let read_message_type = (buffer: Buffer.T) => {
  return Buffer.read_u8(buffer)
}

export let init_identity = () => {
  let buffer = Buffer.make(5)
  Buffer.write_u8(buffer, MessageType.Identity)
  return buffer
}

export let write_identity = (buffer: Buffer.T, id: number) => {
  Buffer.write_u32(buffer, id)
}

export let read_identity = (buffer: Buffer.T) => {
  return Buffer.read_u32(buffer)
}

export let init_time_sync_request = () => {
  let buffer = Buffer.make(9)
  Buffer.write_u8(buffer, MessageType.TimeSyncRequest)
  return buffer
}

export let write_time_sync_request = (buffer: Buffer.T, t_mono: number) => {
  Buffer.write_f64(buffer, t_mono)
}

export let read_time_sync_request = (buffer: Buffer.T) => {
  return Buffer.read_f64(buffer)
}

export let init_time_sync_response = () => {
  let buffer = Buffer.make(17)
  Buffer.write_u8(buffer, MessageType.TimeSyncResponse)
  return buffer
}

export let write_time_sync_response = (
  buffer: Buffer.T,
  t_mono_origin: number,
  t_mono_remote: number,
) => {
  Buffer.write_f64(buffer, t_mono_origin)
  Buffer.write_f64(buffer, t_mono_remote)
}

export let read_time_sync_response = (
  buffer: Buffer.T,
  out: [number, number],
) => {
  out[0] = Buffer.read_f64(buffer)
  out[1] = Buffer.read_f64(buffer)
}
