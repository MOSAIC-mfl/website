import { PAGE_SIZES } from '../../lib/domain/query'

/** First, last, current ±1, with ellipses for the gaps (as in the approved design). */
export function pageWindow(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = [...new Set([1, totalPages, page, page - 1, page + 1])].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of pages) {
    if (prev && p - prev > 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }
  return out
}

interface Props {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

export function Pagination({ page, pageSize, total, onPage, onPageSize }: Props) {
  if (total === 0) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <div className="pagination-nav">
        <button className="page-arrow" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`gap-${i}`} className="page-ellipsis" aria-hidden="true">…</span>
          ) : (
            <button key={p} className={`page-num${p === page ? ' active' : ''}`} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}>
              {p}
            </button>
          ),
        )}
        <button className="page-arrow" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div className="per-page">
        <label htmlFor="per-page-select">Show</label>
        <select id="per-page-select" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n} per page</option>
          ))}
        </select>
      </div>
    </div>
  )
}
