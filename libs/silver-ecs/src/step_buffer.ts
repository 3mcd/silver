export type StepBuffer<U> = {
  steps: number[]
  values: U[][]
  lo: number
  hi: number
}
export type T<U> = StepBuffer<U>

export type DrainIteratee<U> = (value: U) => void

export const insert = <U>(buffer: StepBuffer<U>, key: number, value: U) => {
  const values = buffer.values[key]
  if (values !== undefined) {
    values.push(value)
    return
  }
  const ltLo = key < buffer.lo
  const gtHi = key > buffer.hi
  if (ltLo && gtHi) {
    buffer.lo = key
    buffer.hi = key
    buffer.steps = [key]
  } else if (ltLo) {
    buffer.lo = key
    buffer.steps.unshift(key)
  } else if (gtHi) {
    buffer.hi = key
    buffer.steps.push(key)
  } else {
    for (let i = buffer.steps.length - 1; i >= 0; i--) {
      const hi = buffer.steps[i]
      buffer.steps[i + 1] = hi
      if (hi < key) {
        buffer.steps[i] = key
        break
      }
    }
  }
  buffer.values[key] = [value]
}

export const drainTo = <U>(
  buffer: StepBuffer<U>,
  key: number,
  drain?: DrainIteratee<U>,
) => {
  let i = 0
  let lo: number | undefined
  if (key < buffer.lo) return
  for (; i < buffer.steps.length; i++) {
    lo = buffer.steps[i]
    if (lo <= key) {
      const vLo = buffer.values[lo]
      for (let j = 0; j < vLo.length; j++) {
        const value = vLo[j]
        drain?.(value)
      }
      buffer.values[lo] = undefined!
    }
    if (lo >= key) break
  }
  buffer.steps.splice(0, i + 1)
  if (buffer.steps.length === 0) {
    buffer.lo = Infinity
    buffer.hi = -Infinity
  } else if (lo !== undefined) {
    buffer.lo = lo
  }
}

export const drainBetween = <U>(
  buffer: StepBuffer<U>,
  lo: number,
  hi: number,
  drain: DrainIteratee<U>,
) => {
  if (lo > hi) return
  if (lo < buffer.lo) return
  let i = 0
  for (; i < buffer.steps.length; i++) {
    const step = buffer.steps[i]
    if (step > hi) break
    if (step >= lo) {
      const vStep = buffer.values[step]
      for (let j = 0; j < vStep.length; j++) {
        const value = vStep[j]
        drain(value)
      }
    }
  }
}

export const make = <U>(): StepBuffer<U> => {
  return {
    steps: [],
    values: [],
    lo: Infinity,
    hi: -Infinity,
  }
}

if (import.meta.vitest) {
  const {describe, it, expect} = await import("vitest")
  describe("step_buffer", () => {
    it("inserts elements in order", () => {
      const buffer = make<string>()
      const out: string[] = []
      const a = "a"
      const b = "b"
      insert(buffer, 0, b)
      insert(buffer, 1, a)
      drainTo(buffer, 1, value => {
        out.push(value)
      })
      expect(out).toEqual([b, a])
    })
    it("drains up to provided step", () => {
      const buffer = make<string>()
      const out: string[] = []
      const a = "a"
      const b = "b"
      const c = "c"
      insert(buffer, 15, b)
      insert(buffer, 27, a)
      insert(buffer, 3, c)
      drainTo(buffer, 17, value => {
        out.push(value)
      })
      expect(out).toEqual([c, b])
    })
    it("inserts elements in order after drain", () => {
      const buffer = make<string>()
      const out: string[] = []
      const a = "a"
      const b = "b"
      const c = "c"
      const d = "d"
      insert(buffer, 15, b)
      insert(buffer, 27, a)
      drainTo(buffer, 30)
      insert(buffer, 99, c)
      insert(buffer, 88, d)
      drainTo(buffer, 100, value => {
        out.push(value)
      })
      expect(out).toEqual([d, c])
    })
    it("does not yield previously drained values", () => {
      const buffer = make<number>()
      const out: number[] = []
      for (let i = 0; i < 100; i++) {
        insert(buffer, i, i)
      }
      drainTo(buffer, 50)
      drainTo(buffer, 50, value => {
        out.push(value)
      })
      expect(out).toEqual([])
    })
    it("does nothing when draining to out-of-range step", () => {
      const buffer = make<number>()
      const out: number[] = []
      for (let i = 0; i < 100; i++) {
        insert(buffer, i, i)
      }
      drainTo(buffer, 100)
      drainTo(buffer, 175, value => {
        out.push(value)
      })
      expect(out).toEqual([])
    })
  })
}
