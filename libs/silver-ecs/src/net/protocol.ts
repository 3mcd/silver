import * as Message from "./message"
import * as Buffer from "../buffer"

export enum MessageType {
  Identity = 0,
}

export let identity = Message.make<number>(
  MessageType.Identity,
  function encode_identity(buffer, client_id) {
    Buffer.write_u32(buffer, client_id)
  },
  function decode_identity(buffer) {
    return Buffer.read_u32(buffer)
  },
  5,
)
