let dev = false
DEV: dev = true

let fmt_data = (data: unknown): string => {
  if (data === undefined || data === null) {
    return ""
  }
  if (typeof data === "string") {
    return data
  }
  if (typeof data === "object") {
    try {
      return JSON.stringify(data, null, 2)
    } catch (e) {
      //
    }
  }
  return String(data)
}

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

let formats = {
  trace: "\x1B[32;97m",
  debug: "\x1B[42;97m",
  info: "\x1B[104;97m",
  warn: "\x1B[43;97m",
  error: "\x1B[41;97m",
  fatal: "\x1B[101;97m",
}

let make_logger = (level: Level) => {
  let level_method = level === "fatal" ? "error" : level
  let level_format = formats[level]
  return (scope: string, data: unknown) => {
    if (dev) {
      console[level_method](
        `${level_format}${level_method}(${scope})\x1B[m`,
        fmt_data(data),
      )
    } else {
      console[level_method]({level, scope, data})
    }
  }
}

export let trace = make_logger("trace")
export let debug = make_logger("debug")
export let info = make_logger("info")
export let warn = make_logger("warn")
export let error = make_logger("error")
export let fatal = make_logger("fatal")
