/** Loading and error states (reuse the empty-state style of the approved design). */
export function Loading({ what = 'datasets' }: { what?: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <p>Loading {what}…</p>
    </div>
  )
}

export function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h3>The catalogue could not be loaded</h3>
      <p>{error.message}</p>
      <button type="button" className="empty-state-clear" onClick={onRetry}>Try again</button>
    </div>
  )
}
