export interface Transport {
  send(packet: ArrayBuffer): void
}

export class WriteStream {
  static #ids = 0
  readonly id = WriteStream.#ids++
  #packets
  #view
  #offset
  #mtu

  constructor(mtu = 1_300) {
    let packet = new ArrayBuffer(5, {maxByteLength: mtu})
    this.#packets = [packet]
    this.#view = new DataView(packet)
    this.#mtu = mtu
    this.#offset = 0
    this.#init(0)
  }

  #grow(grow: number) {
    if (this.#offset + grow >= this.#mtu) {
      let packet = new ArrayBuffer(5 + grow, {maxByteLength: this.#mtu})
      this.#packets.push(packet)
      this.#view = new DataView(packet)
      this.#init(this.#view.getUint8(4))
    } else {
      this.#view.buffer.resize(this.#offset + grow)
    }
  }

  #init(index: number) {
    this.#offset = 0
    // id
    this.#view.setUint32(0, this.id)
    // index
    for (let i = 0; i < this.#packets.length; i++) {
      let packet = this.#packets[i]
      let view = new DataView(packet)
      view.setUint8(4, index + 1)
    }
    this.#offset = 5
  }

  writeU8(value: number) {
    this.#grow(1)
    this.#view.setUint8(this.#offset, value)
    this.#offset++
  }

  writeU16(value: number) {
    this.#grow(2)
    this.#view.setUint16(this.#offset, value, true)
    this.#offset += 2
  }

  writeU32(value: number) {
    this.#grow(4)
    this.#view.setUint32(this.#offset, value, true)
    this.#offset += 4
  }

  writeF32(value: number) {
    this.#grow(4)
    this.#view.setFloat32(this.#offset, value, true)
    this.#offset += 4
  }

  writeF64(value: number) {
    this.#grow(8)
    this.#view.setFloat64(this.#offset, value, true)
    this.#offset += 8
  }

  send(transport: Transport) {
    for (let i = 0; i < this.#packets.length; i++) {
      transport.send(this.#packets[i])
    }
  }
}
