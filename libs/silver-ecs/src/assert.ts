const ERR_INTERNAL = "Unexpected error"

class Assertion_error extends Error {
  name = "Assertion_error"
}

export function ok(
  condition: boolean,
  message: string = ERR_INTERNAL,
): asserts condition {
  if (!condition) {
    throw new Assertion_error(message)
  }
}

export const exists = <T>(value: T | undefined, message?: string): T => {
  if (DEBUG) ok(value != undefined, message)
  return value!
}
