import {fatal} from "#logger"

let ERR_INTERNAL = "Unexpected"

export class AssertionError extends Error {
  name = "AssertionError"
}

export function assert(
  condition: boolean,
  message: string = ERR_INTERNAL,
): asserts condition {
  if (!condition) {
    fatal("assertion", {message})
    throw new AssertionError(message)
  }
}

export class ExistsError extends Error {
  name = "ExistsError"
}

export let is_exists_error = (error: unknown): error is ExistsError =>
  error instanceof ExistsError

// export let exists = <T>(value: T | undefined, message?: string): T => {
//   ok(value != undefined, message)
//   return value!
// }

export function assert_exists<T>(
  value: T | null | undefined,
  message: string = ERR_INTERNAL,
): T {
  if (value == null) {
    fatal("assert_exists", {message})
    throw new ExistsError(message)
  }
  return value
}
