import * as Stream from "./stream"
import {suite, test, expect} from "vitest"

suite("WriteStream", () => {
  test("grows", () => {
    let transport = {
      send(packet: ArrayBuffer) {
        console.log(packet.byteLength)
      },
    }
    let stream = new Stream.WriteStream(16)
    for (let i = 0; i < 10; i++) {
      stream.writeU8(i)
      stream.writeU16(i)
    }
    stream.send(transport)
  })
})
