/** A minimal observable store (React reads it with useSyncExternalStore). */
export class Store<S> {
  private listeners = new Set<() => void>()

  constructor(private state: S) {}

  get = (): S => this.state

  set(patch: Partial<S> | ((s: S) => Partial<S>)): void {
    const next = typeof patch === 'function' ? patch(this.state) : patch
    this.state = { ...this.state, ...next }
    this.listeners.forEach((l) => l())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
