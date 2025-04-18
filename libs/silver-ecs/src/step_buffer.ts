class StepBuffer<T> {
  #lo = Infinity
  #hi = -Infinity
  #steps: number[] = []
  #step_data: T[][] = []
  #step_indices: number[] = []

  insert(step: number, value: T) {
    let step_index = this.#step_indices[step]
    // fast path if the step is already in the buffer
    if (step_index !== undefined) {
      this.#step_data[step_index].push(value)
      return
    }
    // if the step is less than the lowest step in the buffer, insert it at the beginning
    if (step < this.#lo) {
      this.#steps.unshift(step)
      this.#step_data.unshift([value])
      step_index = this.#step_indices[step] = 0
      for (let i = 1; i < this.#steps.length; i++) {
        const next_step = this.#steps[i]
        this.#step_indices[next_step]++
      }
    }
    // if the step is greater than the highest step in the buffer, insert it at the end
    else if (step > this.#hi) {
      this.#steps.push(step)
      step_index = this.#step_indices[step] = this.#steps.length - 1
      // initialize the step data at the new index
      this.#step_data[step_index] = [value]
    }
    // otherwise, find the highest step in the buffer that is lower than the given step
    else {
      let i = this.#steps.length - 1
      for (; i >= 0; i--) {
        const hi = this.#steps[i]
        const next_index = i + 1
        if (step < hi) {
          // if the visited step is larger than the inserted step, shift the
          this.#steps[next_index] = hi
          this.#step_data[next_index] = this.#step_data[i]
          this.#step_indices[hi] = next_index
        } else {
          // otherwise, insert the step at the empty index to the right
          this.#steps[next_index] = step
          this.#step_data[next_index] = [value]
          this.#step_indices[step] = next_index
          break
        }
      }
    }
    // update the upper and lower bounds
    this.#lo = step < this.#lo ? step : this.#lo
    this.#hi = step > this.#hi ? step : this.#hi
  }

  drain_all(iteratee?: (value: T, step: number) => void) {
    for (let i = 0; i < this.#steps.length; i++) {
      const step = this.#steps[i]
      const step_data = this.#step_data[i]
      for (let j = 0; j < step_data.length; j++) {
        const value = step_data[j]
        iteratee?.(value, step)
      }
      this.#step_indices[step] = undefined!
    }
    while (this.#steps.pop() !== undefined) {}
    while (this.#step_data.pop() !== undefined) {}
    this.#lo = Infinity
    this.#hi = -Infinity
  }

  drain_to(step: number, iteratee?: (value: T, step: number) => void) {
    if (step < this.#lo) {
      return
    }
    if (step >= this.#hi) {
      this.drain_all(iteratee)
      return
    }
    let hi = this.#step_indices[step]
    if (hi === undefined) {
      for (let i = this.#steps.length - 1; i >= 0; i--) {
        const s = this.#steps[i]
        if (s <= step) {
          hi = i
          break
        }
      }
    }
    for (let i = 0; i <= hi; i++) {
      const s = this.#steps[i]
      const s_data = this.#step_data[i]
      for (let j = 0; j < s_data.length; j++) {
        const value = s_data[j]
        iteratee?.(value, s)
      }
      this.#step_indices[s] = undefined!
    }
    let j = 0
    for (let i = hi + 1; i < this.#steps.length; i++) {
      const s = this.#steps[i]
      const s_data = this.#step_data[i]
      const s_index = j++
      this.#steps[s_index] = s
      this.#step_data[s_index] = s_data
      this.#step_indices[s] = s_index
    }
    for (let i = 0; i < hi + 1; i++) {
      this.#steps.pop()
      this.#step_data.pop()
    }
    this.#lo = this.#steps[0] ?? Infinity
    this.#hi = this.#steps[this.#steps.length - 1] ?? -Infinity
  }

  readAll(iteratee: (value: T, step: number) => void) {
    for (let i = 0; i < this.#steps.length; i++) {
      const s = this.#steps[i]
      const s_data = this.#step_data[i]
      for (let j = 0; j < s_data.length; j++) {
        const value = s_data[j]
        iteratee(value, s)
      }
    }
  }

  readTo(step: number, iteratee: (value: T, step: number) => void) {
    if (step < this.#lo) {
      return
    }
    if (step >= this.#hi) {
      this.readAll(iteratee)
      return
    }
    let hi = this.#step_indices[step]
    if (hi === undefined) {
      for (let i = this.#steps.length - 1; i >= 0; i--) {
        const s = this.#steps[i]
        if (s <= step) {
          hi = i
          break
        }
      }
    }
    for (let i = 0; i <= hi; i++) {
      const s = this.#steps[i]
      const s_data = this.#step_data[i]
      for (let i4 = 0, len1 = s_data.length; i4 < len1; i4++) {
        const value = s_data[i4]
        iteratee(value, s)
      }
    }
  }

  at(step: number): T[] | undefined {
    const step_index = this.#step_indices[step]
    if (step_index === undefined) {
      return
    }
    return this.#step_data[step_index]
  }
}

export type t<U = unknown> = StepBuffer<U>

export const make = <T>() => {
  return new StepBuffer<T>()
}
