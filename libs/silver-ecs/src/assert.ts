const ERR_INTERNAL = "Unexpected error"

class AssertionError extends Error {
  name = "AssertionError"
}

export function ok(
  condition: boolean,
  message: string = ERR_INTERNAL,
): asserts condition {
  if (!condition) {
    throw new AssertionError(message)
  }
}

export const exists = <T>(value: T | undefined, message?: string): T => {
  if (DEBUG) ok(value != undefined, message)
  return value!
}
