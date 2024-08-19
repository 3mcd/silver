export type SignalListener<T> = (event: T) => void

export class Signal<T> {
  listeners

  constructor() {
    this.listeners = [] as SignalListener<T>[]
  }
}
export type T<U> = Signal<U>

export let emit = <U>(signal: Signal<U>, event: U) => {
  for (let i = signal.listeners.length - 1; i >= 0; i--) {
    let listener = signal.listeners[i]
    listener(event)
  }
}

export let subscribe = <U>(signal: Signal<U>, listener: SignalListener<U>) => {
  let i = signal.listeners.push(listener) - 1
  return () => {
    signal.listeners.splice(i, 1)
  }
}

export let dispose = <U>(signal: Signal<U>) => {
  signal.listeners = []
}

export let make = <U>(): T<U> => {
  return new Signal()
}
