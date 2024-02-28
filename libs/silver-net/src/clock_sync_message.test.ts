import {
  encode_request,
  decode_request,
  encode_response,
  decode_response,
  REQUEST_MESSAGE_SIZE,
  RESPONSE_MESSAGE_SIZE,
} from "./clock_sync_message"
import {suite, test, expect} from "vitest"

suite("clock_sync_message", () => {
  test("encode_request out of bounds", () => {
    let message = new ArrayBuffer(REQUEST_MESSAGE_SIZE - 1)
    let view = new DataView(message)
    expect(() => encode_request(view, 0, 1)).toThrow()
  })
  test("decode_request", () => {
    let message = new ArrayBuffer(REQUEST_MESSAGE_SIZE)
    let view = new DataView(message)
    encode_request(view, 0, 1)
    expect(decode_request(view, 0)).toBe(1)
  })
  test("decode_request out of bounds", () => {
    let message = new ArrayBuffer(REQUEST_MESSAGE_SIZE - 1)
    let view = new DataView(message)
    expect(() => decode_request(view, 0)).toThrow()
  })
  test("encode_response out of bounds", () => {
    let message = new ArrayBuffer(RESPONSE_MESSAGE_SIZE - 1)
    let view = new DataView(message)
    expect(() => encode_response(view, 0, 1, 2)).toThrow()
  })
  test("decode_response", () => {
    let message = new ArrayBuffer(RESPONSE_MESSAGE_SIZE)
    let view = new DataView(message)
    let sample = {client_time: 1, server_time: 2}
    encode_response(view, 0, 1, 2)
    decode_response(view, 0, sample)
    expect(sample.client_time).toBe(1)
    expect(sample.server_time).toBe(2)
  })
  test("decode_response out of bounds", () => {
    let message = new ArrayBuffer(RESPONSE_MESSAGE_SIZE - 1)
    let view = new DataView(message)
    expect(() =>
      decode_response(view, 0, {client_time: 0, server_time: 0}),
    ).toThrow()
  })
})
