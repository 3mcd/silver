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

export let trace = (scope: string, data: unknown) => {
  if (dev) {
    console.trace(`\x1B[32;97mtrace(${scope})\x1B[m`, fmt_data(data))
  } else {
    console.trace({level: "trace", scope, data})
  }
}

export let debug = (scope: string, data: unknown) => {
  if (dev) {
    console.debug(`\x1B[42;97mdebug(${scope})\x1B[m`, fmt_data(data))
  } else {
    console.debug({level: "debug", scope, data})
  }
}

export let info = (scope: string, data: unknown) => {
  if (dev) {
    console.info(`\x1B[104;97minfo(${scope})\x1B[m`, fmt_data(data))
  } else {
    console.info({level: "info", scope, data})
  }
}

export let warn = (scope: string, data: unknown) => {
  if (dev) {
    console.warn(`\x1B[43;97mwarn(${scope})\x1B[m`, fmt_data(data))
  } else {
    console.warn({level: "warn", scope, data})
  }
}

export let error = (scope: string, data: unknown) => {
  if (dev) {
    console.error(`\x1B[41;97merror(${scope})\x1B[m`, fmt_data(data))
  } else {
    console.error({level: "error", scope, data})
  }
}

export let fatal = (scope: string, data: unknown) => {
  if (dev) {
    console.error(`\x1B[101;97mfatal(${scope})\x1B[m`, fmt_data(data))
  } else {
    console.error({level: "fatal", scope, data})
  }
}
