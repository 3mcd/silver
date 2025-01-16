import {assert} from "./assert"

const GROW_FACTOR = 1.5

const ceil_log_2 = (n: number) => {
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

const arenas: ArrayBuffer[][] = []

for (const i in ((s, e) => {
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
  constructor(init: ArrayBuffer, writeOffset = 0) {
    this.write_offset = writeOffset
    this.buffer = init
    this.view = new DataView(this.buffer)
  }
}

export type T = Buffer

export function make(length: number, maxLength?: number): Buffer
export function make(ab: ArrayBuffer): Buffer
export function make(init: number | ArrayBuffer, maxLength?: number) {
  if (typeof init === "object") {
    // use provided ArrayBuffer directly, inferring the write offset
    // from its byteLength
    return new Buffer(init, init.byteLength)
  } else if (maxLength !== undefined) {
    // both a length and max length were provided; reuse or create a
    // growable ArrayBuffer of the appropriate size
    DEV: {
      assert(maxLength <= 0x40000000)
      assert(maxLength >= init)
    }
    const i = ceil_log_2(Math.max(2, maxLength | 0))
    return new Buffer(
      arenas[i].pop() ?? new ArrayBuffer(init, {maxByteLength: 1 << i}),
    )
  } else {
    // a length was passed; create a new fixed-length ArrayBuffer
    return new Buffer(new ArrayBuffer(init))
  }
}

export const readable = (buffer: Buffer) => {
  return buffer.read_offset < buffer.write_offset
}

export const grow = (buffer: Buffer, bytes: number) => {
  const length = bytes + buffer.write_offset
  if (length > buffer.buffer.byteLength) {
    assert(buffer.buffer.resizable)
    buffer.buffer.resize(length * GROW_FACTOR)
  }
}

export const write_i8 = (buffer: Buffer, n: number) => {
  grow(buffer, 1)
  buffer.view.setInt8(buffer.write_offset, n)
  buffer.write_offset += 1
}

export const write_i16 = (buffer: Buffer, n: number) => {
  grow(buffer, 2)
  buffer.view.setInt16(buffer.write_offset, n, true)
  buffer.write_offset += 2
}

export const write_i32 = (buffer: Buffer, n: number) => {
  grow(buffer, 4)
  buffer.view.setInt32(buffer.write_offset, n, true)
  buffer.write_offset += 4
}

export const write_u8 = (buffer: Buffer, n: number) => {
  grow(buffer, 1)
  buffer.view.setUint8(buffer.write_offset, n)
  buffer.write_offset += 1
}

export const write_u16 = (buffer: Buffer, n: number) => {
  grow(buffer, 2)
  buffer.view.setUint16(buffer.write_offset, n, true)
  buffer.write_offset += 2
}

export const write_u32 = (buffer: Buffer, n: number) => {
  const offset = buffer.write_offset
  grow(buffer, 4)
  buffer.view.setUint32(offset, n, true)
  buffer.write_offset += 4
  return offset
}

export const write_u32_at = (buffer: Buffer, n: number, offset: number) => {
  return buffer.view.setUint32(offset, n, true)
}

export const write_f32 = (buffer: Buffer, n: number) => {
  grow(buffer, 4)
  buffer.view.setFloat32(buffer.write_offset, n, true)
  return (buffer.write_offset += 4)
}

export const write_f64 = (buffer: Buffer, n: number) => {
  grow(buffer, 8)
  buffer.view.setFloat64(buffer.write_offset, n, true)
  return (buffer.write_offset += 8)
}

export const read_i8 = (buffer: Buffer) => {
  const n = buffer.view.getInt8(buffer.read_offset)
  buffer.read_offset += 1
  return n
}

export const read_i16 = (buffer: Buffer) => {
  const n = buffer.view.getInt16(buffer.read_offset, true)
  buffer.read_offset += 2
  return n
}

export const read_i32 = (buffer: Buffer) => {
  const n = buffer.view.getInt32(buffer.read_offset, true)
  buffer.read_offset += 4
  return n
}

export const read_u8 = (buffer: Buffer) => {
  const n = buffer.view.getUint8(buffer.read_offset)
  buffer.read_offset += 1
  return n
}

export const peek_u8 = (buffer: Buffer) => {
  const n = buffer.view.getUint32(buffer.read_offset, true)
  return n
}

export const read_u16 = (buffer: Buffer) => {
  const n = buffer.view.getUint16(buffer.read_offset, true)
  buffer.read_offset += 2
  return n
}

export const read_u32 = (buffer: Buffer) => {
  const n = buffer.view.getUint32(buffer.read_offset, true)
  buffer.read_offset += 4
  return n
}

export const peek_u32 = (buffer: Buffer) => {
  const n = buffer.view.getUint32(buffer.read_offset, true)
  return n
}

export const read_f32 = (buffer: Buffer) => {
  const n = buffer.view.getFloat32(buffer.read_offset, true)
  buffer.read_offset += 4
  return n
}

export const read_f64 = (buffer: Buffer) => {
  const n = buffer.view.getFloat64(buffer.read_offset, true)
  buffer.read_offset += 8
  return n
}

export const free = (buffer: Buffer) => {
  if (buffer.buffer.resizable) {
    const i = ceil_log_2(buffer.buffer.maxByteLength)
    const arena = arenas[i]
    if (arena.length < 100) {
      arenas[i].push(buffer.buffer)
    }
  }
}

export const end = (buffer: Buffer) => {
  free(buffer)
  return buffer.buffer.slice(0, buffer.write_offset)
}
