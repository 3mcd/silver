// import {Component, Registry, Scalar, Schema} from "../core"
import {assert_exists} from "#assert"
import * as Buffer from "#buffer"
import * as Component from "#component"
import * as Schema from "#schema"

type Encode = (b: Buffer.T, d: unknown) => void
type Decode = (b: Buffer.T, e: number, w: unknown[], create?: boolean) => void

let make_encode_exp = (schema: Schema.T, exp: string = "d") => {
  if (typeof schema === "string") {
    return `${Schema.Scalar[schema]}(b,${exp});`
  }
  let fields = Object.entries(schema)
  let out = ""
  for (let [field_name, field_schema] of fields) {
    out += make_encode_exp(field_schema, `${exp}.${field_name}`)
  }
  return out
}

let make_decode_dec = (schema: Schema.T) => {
  return `let d=w[e];if(d===undefined){if(c){${make_encode_exp_create(
    schema,
  )}}else{${make_decode_exp_noop(schema)}return}}`
}

let make_encode_exp_create = (schema: Schema.T) => {
  return `d=w[e]=${typeof schema === "object" ? "{}" : "undefined"};`
}

let make_decode_exp_noop = (schema: Schema.T): string => {
  if (typeof schema === "string") {
    return `${Schema.Scalar[schema]}(b);`
  }
  let fields = Object.values(schema)
  let out = ""
  for (let i = 0; i < fields.length; i++) {
    let field_schema = fields[i]
    out += make_decode_exp_noop(field_schema)
  }
  return out
}

let make_decode_exp = (schema: Schema.T, exp: string) => {
  if (typeof schema === "string") {
    return `${exp}=${Schema.Scalar[schema]}(b);`
  }
  let fields = Object.entries(schema)
  let out = ""
  for (let [field_name, field_schema] of fields) {
    out += make_decode_exp(field_schema, `${exp}.${field_name}`)
  }
  return out
}

let compileEncoder = (schema: Schema.T): Encode => {
  let body = `return(b,d)=>{${make_encode_exp(schema)}}`
  return Function(
    "i8",
    "i16",
    "i32",
    "u8",
    "u16",
    "u32",
    "f32",
    "f64",
    body,
  )(
    Buffer.write_i8,
    Buffer.write_i16,
    Buffer.write_i32,
    Buffer.write_u8,
    Buffer.write_u16,
    Buffer.write_u32,
    Buffer.write_f32,
    Buffer.write_f64,
  )
}

let compileDecoder = (schema: Schema.T): Decode => {
  let body = `return(b,e,w,c=false)=>{${make_decode_dec(
    schema,
  )}${make_decode_exp(schema, typeof schema === "object" ? "d" : "w[e]")}}`
  return Function(
    "i8",
    "i16",
    "i32",
    "u8",
    "u16",
    "u32",
    "f32",
    "f64",
    body,
  )(
    Buffer.read_i8,
    Buffer.read_i16,
    Buffer.read_i32,
    Buffer.read_u8,
    Buffer.read_u16,
    Buffer.read_u32,
    Buffer.read_f32,
    Buffer.read_f64,
  )
}

class RefEncoding implements T {
  encode
  decode
  constructor(ref: Component.Ref) {
    let schema = assert_exists(ref.schema)
    this.encode = compileEncoder(schema)
    this.decode = compileDecoder(schema)
  }
}

export type T = RefEncoding

export let make = (ref: Component.Ref) => {
  return new RefEncoding(ref)
}
