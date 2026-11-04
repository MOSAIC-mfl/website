import type { SortKey } from '../../lib/domain/query'

export type ViewMode = 'card' | 'list'

const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Best match',
  recent: 'Most recent',
  oldest: 'Oldest',
  az: 'A → Z',
  za: 'Z → A',
}

interface Props {
  text: string
  sort: SortKey
  viewMode: ViewMode
  onText: (text: string) => void
  onSort: (sort: SortKey) => void
  onViewMode: (mode: ViewMode) => void
}

export function ResultsToolbar({ text, sort, viewMode, onText, onSort, onViewMode }: Props) {
  return (
    <div className="results-toolbar">
      <div className="search-wrapper">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <label htmlFor="dataset-search" className="sr-only">Search datasets</label>
        <input
          type="search"
          id="dataset-search"
          className="search-input"
          placeholder="Search by title, theme, keyword…"
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
      </div>

      <div className="toolbar-right">
        <label htmlFor="sort-select" className="sort-label">Sort by</label>
        <select id="sort-select" className="sort-select" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
          {(Object.keys(SORT_LABELS) as SortKey[])
            .filter((k) => k !== 'relevance' || text.trim())
            .map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
        </select>

        <div className="view-toggle-group" role="group" aria-label="View mode">
          <button type="button" className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => onViewMode('list')} aria-pressed={viewMode === 'list'} aria-label="List view" title="List view">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button type="button" className={`view-toggle-btn${viewMode === 'card' ? ' active' : ''}`} onClick={() => onViewMode('card')} aria-pressed={viewMode === 'card'} aria-label="Grid view" title="Grid view">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
