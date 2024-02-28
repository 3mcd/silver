let ERR_INTERNAL = "Unexpected error"

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

export let value = <T>(value: T | undefined, message?: string): T => {
  ok(value != undefined, message)
  return value!
}
