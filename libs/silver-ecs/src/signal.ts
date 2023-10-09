export type SignalListener<T> = (event: T) => void
export type ReadonlySignal<T> = Omit<Signal<T>, "dispatch">

export class Signal<T> {
  listeners

  constructor() {
    this.listeners = [] as SignalListener<T>[]
  }
}
export type T<U> = Signal<U>

export const emit = <U>(signal: Signal<U>, event: U) => {
  for (let i = signal.listeners.length - 1; i >= 0; i--) {
    const listener = signal.listeners[i]
    listener(event)
  }
}

export const subscribe = <U>(
  signal: Signal<U>,
  listener: SignalListener<U>,
) => {
  const listenerIndex = signal.listeners.push(listener) - 1
  return () => {
    signal.listeners.splice(listenerIndex, 1)
  }
}

export const dispose = <U>(signal: Signal<U>) => {
  signal.listeners = []
}

export const make = <U>(): Signal<U> => {
  return new Signal()
}
