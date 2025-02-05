import {assert} from "./assert"

let GROW_FACTOR = 1.5

let ceil_log_2 = (n: number) => {
  let v = n - 1
  let r = v > 0xffff ? 1 << 4 : 0
  v >>>= r
  let s = v > 0xff ? 1 << 3 : 0
  v >>>= s
  r |= s
  s = v > 0xf ? 1 << 2 : 0
  v >>>= s
  r |= s
  s = v > 0x3 ? 1 << 1 : 0
  v >>>= s
  r += s
  return (r | (v >> 1)) + 1
}

let arenas: ArrayBuffer[][] = []

for (let i in ((s, e) => {
  let step = e > s ? 1 : -1
  return Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + i * step)
})(0, 32)) {
  arenas[i] = []
}

class Buffer {
  buffer
  read_offset = 0
  write_offset
  view
  constructor(init: ArrayBufferLike, writeOffset = 0) {
    this.write_offset = writeOffset
    this.buffer = init
    this.view = new DataView(this.buffer)
  }
}

export type T = Buffer

export function make(length: number, max_length?: number): Buffer
export function make(ab: ArrayBufferLike): Buffer
export function make(init: number | ArrayBufferLike, max_length?: number) {
  if (typeof init === "object") {
    // use provided ArrayBuffer directly, inferring the write offset
    // from its byteLength
    return new Buffer(init, init.byteLength)
  } else if (max_length !== undefined) {
    // both a length and max length were provided; reuse or create a
    // growable ArrayBuffer of the appropriate size
    DEV: {
      assert(max_length <= 0x40000000)
      assert(max_length >= init)
    }
    let i = ceil_log_2(Math.max(2, max_length | 0))
    return new Buffer(
      arenas[i].pop() ?? new ArrayBuffer(init, {maxByteLength: 1 << i}),
    )
  } else {
    // a length was passed; create a new fixed-length ArrayBuffer
    return new Buffer(new ArrayBuffer(init))
  }
}

export let readable = (buffer: Buffer) => {
  return buffer.read_offset < buffer.write_offset
}

export let grow = (buffer: Buffer, bytes: number) => {
  let length = bytes + buffer.write_offset
  if (length > buffer.buffer.byteLength) {
    assert("resize" in buffer.buffer)
    assert(buffer.buffer.resizable)
    buffer.buffer.resize(length * GROW_FACTOR)
  }
}

export let write_i8 = (buffer: Buffer, n: number) => {
  grow(buffer, 1)
  buffer.view.setInt8(buffer.write_offset, n)
  buffer.write_offset += 1
}

export let write_i16 = (buffer: Buffer, n: number) => {
  grow(buffer, 2)
  buffer.view.setInt16(buffer.write_offset, n, true)
  buffer.write_offset += 2
}

export let write_i32 = (buffer: Buffer, n: number) => {
  grow(buffer, 4)
  buffer.view.setInt32(buffer.write_offset, n, true)
  buffer.write_offset += 4
}

export let write_u8 = (buffer: Buffer, n: number) => {
  grow(buffer, 1)
  buffer.view.setUint8(buffer.write_offset, n)
  buffer.write_offset += 1
}

export let write_u16 = (buffer: Buffer, n: number) => {
  grow(buffer, 2)
  buffer.view.setUint16(buffer.write_offset, n, true)
  buffer.write_offset += 2
}

export let write_u32 = (buffer: Buffer, n: number) => {
  let offset = buffer.write_offset
  grow(buffer, 4)
  buffer.view.setUint32(offset, n, true)
  buffer.write_offset += 4
  return offset
}

export let write_u32_at = (buffer: Buffer, n: number, offset: number) => {
  return buffer.view.setUint32(offset, n, true)
}

export let write_f32 = (buffer: Buffer, n: number) => {
  grow(buffer, 4)
  buffer.view.setFloat32(buffer.write_offset, n, true)
  return (buffer.write_offset += 4)
}

export let write_f64 = (buffer: Buffer, n: number) => {
  grow(buffer, 8)
  buffer.view.setFloat64(buffer.write_offset, n, true)
  return (buffer.write_offset += 8)
}

export let read_i8 = (buffer: Buffer) => {
  let n = buffer.view.getInt8(buffer.read_offset)
  buffer.read_offset += 1
  return n
}

export let read_i16 = (buffer: Buffer) => {
  let n = buffer.view.getInt16(buffer.read_offset, true)
  buffer.read_offset += 2
  return n
}

export let read_i32 = (buffer: Buffer) => {
  let n = buffer.view.getInt32(buffer.read_offset, true)
  buffer.read_offset += 4
  return n
}

export let read_u8 = (buffer: Buffer) => {
  let n = buffer.view.getUint8(buffer.read_offset)
  buffer.read_offset += 1
  return n
}

export let peek_u8 = (buffer: Buffer) => {
  let n = buffer.view.getUint8(buffer.read_offset)
  return n
}

export let read_u16 = (buffer: Buffer) => {
  let n = buffer.view.getUint16(buffer.read_offset, true)
  buffer.read_offset += 2
  return n
}

export let read_u32 = (buffer: Buffer) => {
  let n = buffer.view.getUint32(buffer.read_offset, true)
  buffer.read_offset += 4
  return n
}

export let peek_u32 = (buffer: Buffer) => {
  let n = buffer.view.getUint32(buffer.read_offset, true)
  return n
}

export let read_f32 = (buffer: Buffer) => {
  let n = buffer.view.getFloat32(buffer.read_offset, true)
  buffer.read_offset += 4
  return n
}

export let read_f64 = (buffer: Buffer) => {
  let n = buffer.view.getFloat64(buffer.read_offset, true)
  buffer.read_offset += 8
  return n
}

export let free = (buffer: Buffer) => {
  if ("resizable" in buffer.buffer) {
    let i = ceil_log_2(buffer.buffer.maxByteLength)
    let arena = arenas[i]
    if (arena.length < 100) {
      arenas[i].push(buffer.buffer)
    }
  }
}

export let end = (buffer: Buffer) => {
  free(buffer)
  return new Uint8Array(buffer.buffer.slice(0, buffer.write_offset))
}
