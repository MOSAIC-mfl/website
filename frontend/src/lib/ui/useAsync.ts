import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ok'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }

/** Runs `run` when `deps` change; ignores results that arrive after a newer call (no races). */
export function useAsync<T>(run: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    setState((s) => (s.status === 'ok' ? s : { status: 'loading' }))
    run().then(
      (data) => current && setState({ status: 'ok', data }),
      (error: unknown) => current && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => {
      current = false
    }
  }, [...deps, attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
