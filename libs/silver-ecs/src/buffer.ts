import {assert} from "./assert.ts"

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

export class Buffer {
  buffer
  read_offset = 0
  write_offset
  view
  constructor(init: ArrayBufferLike, writeOffset = 0) {
    this.write_offset = writeOffset
    this.buffer = init
    this.view = new DataView(this.buffer)
  }

  readable() {
    return this.read_offset < this.write_offset
  }

  grow(bytes: number) {
    let length = bytes + this.write_offset
    if (length > this.buffer.byteLength) {
      assert("resize" in this.buffer)
      assert(this.buffer.resizable)
      this.buffer.resize(length * GROW_FACTOR)
    }
  }

  write_i8(n: number) {
    this.grow(1)
    this.view.setInt8(this.write_offset, n)
    this.write_offset += 1
  }

  write_i16(n: number) {
    this.grow(2)
    this.view.setInt16(this.write_offset, n, true)
    this.write_offset += 2
  }

  write_i32(n: number) {
    this.grow(4)
    this.view.setInt32(this.write_offset, n, true)
    this.write_offset += 4
  }

  write_u8(n: number) {
    this.grow(1)
    this.view.setUint8(this.write_offset, n)
    this.write_offset += 1
  }

  write_u8_at(n: number, offset: number) {
    this.view.setUint8(offset, n)
  }

  write_u16(n: number) {
    this.grow(2)
    this.view.setUint16(this.write_offset, n, true)
    this.write_offset += 2
  }

  write_u32(n: number) {
    let offset = this.write_offset
    this.grow(4)
    this.view.setUint32(offset, n, true)
    this.write_offset += 4
    return offset
  }

  write_u32_at(n: number, offset: number) {
    this.view.setUint32(offset, n, true)
  }

  write_f32(n: number) {
    this.grow(4)
    this.view.setFloat32(this.write_offset, n, true)
    this.write_offset += 4
  }

  write_f64(n: number) {
    this.grow(8)
    this.view.setFloat64(this.write_offset, n, true)
    this.write_offset += 8
  }

  read_i8() {
    let n = this.view.getInt8(this.read_offset)
    this.read_offset += 1
    return n
  }

  read_i16() {
    let n = this.view.getInt16(this.read_offset, true)
    this.read_offset += 2
    return n
  }

  read_i32() {
    let n = this.view.getInt32(this.read_offset, true)
    this.read_offset += 4
    return n
  }

  read_u8() {
    let n = this.view.getUint8(this.read_offset)
    this.read_offset += 1
    return n
  }

  peek_u8() {
    return this.view.getUint8(this.read_offset)
  }

  read_u16() {
    let n = this.view.getUint16(this.read_offset, true)
    this.read_offset += 2
    return n
  }

  read_u32() {
    let n = this.view.getUint32(this.read_offset, true)
    this.read_offset += 4
    return n
  }

  peek_u32() {
    return this.view.getUint32(this.read_offset, true)
  }

  read_f32() {
    let n = this.view.getFloat32(this.read_offset, true)
    this.read_offset += 4
    return n
  }

  read_f64() {
    let n = this.view.getFloat64(this.read_offset, true)
    this.read_offset += 8
    return n
  }

  free() {
    if ("resizable" in this.buffer) {
      let i = ceil_log_2(this.buffer.maxByteLength)
      let arena = arenas[i]
      if (arena.length < 100) {
        arenas[i].push(this.buffer)
      }
    }
  }

  end() {
    this.free()
    return new Uint8Array(this.buffer.slice(0, this.write_offset))
  }
}

export type t = Buffer

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
