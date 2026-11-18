/** Loading and error states (reuse the empty-state style of the approved design). */
export function Loading({ what = 'datasets' }: { what?: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <p>Loading {what}…</p>
    </div>
  )
}

/** Says what failed and what to do; the raw message (status code, network error) is folded away. */
export function LoadError({ error, onRetry, what = 'Datasets' }: { error: Error; onRetry: () => void; what?: string }) {
  return (
    <div className="empty-state" role="alert">
      <h3>{what} not loaded</h3>
      <p>MOSAIC could not reach its catalog. Check your connection and try again.</p>
      <button type="button" className="empty-state-clear" onClick={onRetry}>Try again</button>
      <details className="empty-state-detail">
        <summary>Technical detail</summary>
        <p>{error.message}</p>
      </details>
    </div>
  )
}
