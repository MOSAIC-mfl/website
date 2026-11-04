/** Fetching JSON: the one place that talks to the network (timeouts, typed errors). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type JsonFetcher = <T>(url: string) => Promise<T>

export function createJsonFetcher(fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis), timeoutMs = 20_000): JsonFetcher {
  return async <T>(url: string): Promise<T> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status, url)
      return (await res.json()) as T
    } catch (err) {
      if (err instanceof ApiError) throw err
      const reason = err instanceof DOMException && err.name === 'AbortError' ? 'timed out' : String(err)
      throw new ApiError(`Could not reach the catalogue (${reason})`, null, url)
    } finally {
      clearTimeout(timer)
    }
  }
}
