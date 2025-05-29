import {assert_exists} from "#assert"
import * as Buffer from "#buffer"
import * as Component from "#component"
import * as Schema from "#schema"

type Encode = (b: Buffer.t, d: unknown) => void
type Decode = (b: Buffer.t, e: number, w: unknown[], create?: boolean) => void

let make_encode_exp = (schema: Schema.t, exp: string = "d") => {
  if (typeof schema === "string") {
    return `b.write_${Schema.Scalar[schema]}(${exp});`
  }
  let fields = Object.entries(schema)
  let out = ""
  for (let [field_name, field_schema] of fields) {
    out += make_encode_exp(field_schema, `${exp}.${field_name}`)
  }
  return out
}

let make_decode_dec = (schema: Schema.t) => {
  return `let d=w[e];if(d===undefined){if(c){${make_encode_exp_create(
    schema,
  )}}else{${make_decode_exp_noop(schema)}return}}`
}

let make_encode_exp_create = (schema: Schema.t) => {
  return `d=w[e]=${typeof schema === "object" ? "{}" : "undefined"};`
}

let make_decode_exp_noop = (schema: Schema.t): string => {
  if (typeof schema === "string") {
    return `b.read_${Schema.Scalar[schema]}();`
  }
  let fields = Object.values(schema)
  let out = ""
  for (let i = 0; i < fields.length; i++) {
    let field_schema = fields[i]
    out += make_decode_exp_noop(field_schema)
  }
  return out
}

let make_decode_exp = (schema: Schema.t, exp: string) => {
  if (typeof schema === "string") {
    return `${exp}=b.read_${Schema.Scalar[schema]}();`
  }
  let fields = Object.entries(schema)
  let out = ""
  for (let [field_name, field_schema] of fields) {
    out += make_decode_exp(field_schema, `${exp}.${field_name}`)
  }
  return out
}

let compile_encode = (schema: Schema.t): Encode => {
  let body = `return(b,d)=>{${make_encode_exp(schema)}}`
  return Function(body)()
}

let compile_decode = (schema: Schema.t): Decode => {
  let body = `return(b,e,w,c=false)=>{${make_decode_dec(
    schema,
  )}${make_decode_exp(schema, typeof schema === "object" ? "d" : "w[e]")}}`
  return Function(body)()
}

class RefEncoding implements t {
  encode
  decode
  constructor(ref: Component.Ref) {
    let schema = assert_exists(ref.schema)
    this.encode = compile_encode(schema)
    this.decode = compile_decode(schema)
  }
}

export type t = RefEncoding

export let make = (ref: Component.Ref) => {
  return new RefEncoding(ref)
}
