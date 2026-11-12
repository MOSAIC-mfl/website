import { useState, useMemo, useEffect, type ReactNode } from 'react'
import type { Dataset } from '../../utils/types'
import { filterDatasets, emptyFilters, type FilterState } from '../../utils/filterDatasets'
import { DatasetGrid } from './DatasetGrid'
import { READINESS_MEANING, READINESS_NOTE, READINESS_ORDER } from '../../utils/readiness'

interface Props {
  datasets: Dataset[]
  base: string
}

type FilterKey = keyof FilterState
type SortKey = 'recent' | 'oldest' | 'az' | 'za' | 'status'
type ViewMode = 'card' | 'list'

const FILTER_LABELS: Record<FilterKey, string> = {
  country:          'Country',
  living_landscape: 'Living Landscape',
  mfl_theme:        'Theme',
  readiness_status: 'Readiness Status',
  data_type:        'Data Type',
  access_level:     'Access Level',
  license:          'License',
}

const PRIMARY_FILTERS: FilterKey[] = ['country', 'living_landscape', 'mfl_theme', 'readiness_status']
const MORE_FILTERS: FilterKey[] = ['data_type', 'access_level', 'license']

// ── Filter group icons ──────────────────────────────────────────────
const FILTER_ICON: Record<FilterKey, ReactNode> = {
  country: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  living_landscape: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  mfl_theme: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  readiness_status: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  data_type: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  access_level: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  license: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
}

// Multiples of six, so a page fills whole rows of two or three tiles.
const PER_PAGE_OPTIONS = [12, 24, 48]

const FILTER_KEYS: FilterKey[] = ['country', 'living_landscape', 'mfl_theme', 'readiness_status', 'data_type', 'access_level', 'license']
const SORT_KEYS: SortKey[] = ['recent', 'oldest', 'az', 'za', 'status']

// Legacy single-value params used by deep links from the Landscapes page.
const PARAM_ALIASES: Record<string, FilterKey> = {
  landscape: 'living_landscape',
  theme: 'mfl_theme',
  status: 'readiness_status',
}

const QS_STORAGE_KEY = 'mosaic:catalogue:qs'

/** Read filter/search/sort state from the current URL (canonical keys + legacy aliases). */
function readInitialState(datasets: Dataset[]): { filters: FilterState; search: string; sort: SortKey } {
  const filters = emptyFilters()
  let search = ''
  let sort: SortKey = 'recent'
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    for (const key of FILTER_KEYS) {
      // One param per value: license texts can contain commas. Older URLs
      // joined values with ',', so split a param unless it is a whole value.
      const known = new Set(getOptions(datasets, key))
      const values = params.getAll(key).flatMap((raw) =>
        known.has(raw) ? [raw] : raw.split(',').map((v) => v.trim()).filter(Boolean))
      filters[key] = [...new Set(values)]
    }
    for (const [alias, key] of Object.entries(PARAM_ALIASES)) {
      const v = params.get(alias)
      if (v && !(filters[key] as string[]).includes(v)) (filters[key] as string[]).push(v)
    }
    search = params.get('q') ?? ''
    const s = params.get('sort') as SortKey | null
    if (s && SORT_KEYS.includes(s)) sort = s
  }
  return { filters, search, sort }
}

function getOptions(datasets: Dataset[], key: FilterKey): string[] {
  const values = datasets.map((d) => d[key] as string).filter(Boolean)
  return [...new Set(values)].sort()
}

// ── Free-text search ────────────────────────────────────────────────
// Case and accents are ignored ("narino" finds "Nariño").
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Everything a visitor might type to find a record, as one folded string. */
function searchableText(d: Dataset): string {
  return fold(
    [
      d.id,
      d.title,
      d.description,
      d.source,
      d.mfl_theme,
      d.country,
      d.living_landscape,
      d.landscape_name,
      d.data_type,
      d.license,
      ...(d.formats ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

/** The words of a query, folded, without the punctuation around them. */
function queryWords(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)
}

function yearOf(d: Dataset): number {
  const m = (d.temporal_coverage ?? '').match(/\d{4}/)
  return m ? parseInt(m[0], 10) : 0
}

function sortDatasets(datasets: Dataset[], sort: SortKey): Dataset[] {
  const sorted = [...datasets]
  if (sort === 'recent') sorted.sort((a, b) => yearOf(b) - yearOf(a))
  else if (sort === 'oldest') sorted.sort((a, b) => yearOf(a) - yearOf(b))
  else if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title))
  else if (sort === 'za') sorted.sort((a, b) => b.title.localeCompare(a.title))
  else if (sort === 'status') {
    const order = ['Validated', 'Processed', 'Raw']
    sorted.sort((a, b) => order.indexOf(a.readiness_status) - order.indexOf(b.readiness_status))
  }
  return sorted
}

export function CatalogueFilter({ datasets, base }: Props) {
  // Filter VALUES stay landscape codes (stable, used in URLs); LABELS show the
  // display name carried by each dataset record (e.g. "Central India Highlands").
  const landscapeNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const d of datasets) {
      if (d.landscape_name && !names.has(d.living_landscape)) names.set(d.living_landscape, d.landscape_name)
    }
    return names
  }, [datasets])

  const displayValue = (key: FilterKey, value: string) =>
    key === 'living_landscape' ? (landscapeNames.get(value) ?? value) : value

  // The static HTML is built with no filters, so the first client render must
  // start empty as well (otherwise hydration fails); the URL state is applied
  // right after, in an effect.
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [urlApplied, setUrlApplied] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  // Filter groups fold away; all start closed (also in the static HTML, so
  // hydration matches). Groups with a filter from the URL open on their own.
  const [openGroups, setOpenGroups] = useState<Set<FilterKey>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  // Searchable text of each record, built once.
  const searchIndex = useMemo(
    () => new Map(datasets.map((d) => [d.id, searchableText(d)])),
    [datasets],
  )

  const filtered = useMemo(() => {
    let result = filterDatasets(datasets, filters)
    // A record matches when it contains every word typed, in any order and in
    // any of its fields: title, description, source, theme, country, landscape
    // (code and name), record ID, data type, formats and licence.
    const words = queryWords(searchText)
    if (words.length > 0) {
      result = result.filter((d) => {
        const text = searchIndex.get(d.id) ?? ''
        return words.every((w) => text.includes(w))
      })
    }
    return sortDatasets(result, sortKey)
  }, [datasets, filters, searchText, sortKey, searchIndex])

  // Reset to first page whenever the result set changes.
  useEffect(() => { setPage(1) }, [filters, searchText, sortKey, pageSize])

  useEffect(() => {
    const initial = readInitialState(datasets)
    const active = FILTER_KEYS.filter((k) => (initial.filters[k] as string[]).length > 0)
    setOpenGroups(new Set(active))
    if (active.some((k) => MORE_FILTERS.includes(k))) setShowMore(true)
    setFilters(initial.filters)
    setSearchText(initial.search)
    setSortKey(initial.sort)
    setUrlApplied(true)
  }, [datasets])

  // Mirror filter/search/sort state into the URL so the browser Back button
  // (and the detail page's "Back to catalogue" link) restore the same view.
  // Not before the URL state is applied, or the first run would wipe it.
  useEffect(() => {
    if (!urlApplied) return
    const params = new URLSearchParams()
    for (const key of FILTER_KEYS) {
      for (const v of filters[key] as string[]) params.append(key, v)
    }
    if (searchText.trim()) params.set('q', searchText.trim())
    if (sortKey !== 'recent') params.set('sort', sortKey)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    try { sessionStorage.setItem(QS_STORAGE_KEY, qs) } catch { /* storage unavailable */ }
  }, [filters, searchText, sortKey, urlApplied])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  const activeChips = useMemo(() =>
    Object.entries(filters).flatMap(([key, values]) =>
      (values as string[]).map((value) => ({ key: key as FilterKey, value }))
    ), [filters]
  )

  function toggle(key: FilterKey, value: string) {
    setFilters((prev) => {
      const current = prev[key] as string[]
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      }
    })
  }

  function removeChip(key: FilterKey, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (prev[key] as string[]).filter((v) => v !== value) }))
  }

  function clearAll() {
    setFilters(emptyFilters())
    setSearchText('')
  }

  const hasActiveFilters = activeChips.length > 0 || searchText.trim().length > 0

  function toggleGroup(key: FilterKey) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function renderFilterSection(key: FilterKey) {
    // Sorted by what is shown, not by the value behind it: landscapes by name
    // (their values are codes), readiness from Raw to Validated.
    const options = getOptions(datasets, key).sort((a, b) =>
      key === 'readiness_status'
        ? (READINESS_ORDER as readonly string[]).indexOf(a) - (READINESS_ORDER as readonly string[]).indexOf(b)
        : displayValue(key, a).localeCompare(displayValue(key, b)))
    if (options.length === 0) return null
    const open = openGroups.has(key)
    const nSelected = (filters[key] as string[]).length
    const bodyId = `fg-${key}`
    return (
      <div key={key} className="filter-group" data-open={open}>
        <h3 className="filter-group-head">
          <button type="button" className="filter-group-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => toggleGroup(key)}>
            <span className={`filter-group-icon filter-group-icon--${key}`}>{FILTER_ICON[key]}</span>
            <span className="filter-group-label">{FILTER_LABELS[key]}</span>
            {nSelected > 0 && <span className="filter-group-count" aria-label={`${nSelected} selected`}>{nSelected}</span>}
            <svg className="filter-group-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </h3>
        <div className="filter-group-body" id={bodyId}>
        <fieldset className="filter-group-inner">
        <legend className="sr-only">{FILTER_LABELS[key]}</legend>
        <ul className="filter-options">
          {options.map((opt) => {
            const inputId = `f-${key}-${opt.replace(/\s+/g, '-').toLowerCase()}`
            const count = datasets.filter((d) => d[key] === opt).length
            return (
              <li key={opt} className="filter-option">
                <input
                  type="checkbox"
                  id={inputId}
                  checked={(filters[key] as string[]).includes(opt)}
                  onChange={() => toggle(key, opt)}
                />
                <label htmlFor={inputId}>
                  <span>{displayValue(key, opt)}</span>
                  <span className="filter-count">({count})</span>
                </label>
              </li>
            )
          })}
        </ul>
        </fieldset>
        </div>
      </div>
    )
  }

  // Build the visible page-number window: first, last, current ±2, with
  // ellipsis markers for the gaps. Keeps the control compact as data grows.
  const pageItemsList: (number | 'ellipsis')[] = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages = new Set<number>([1, totalPages, page, page - 1, page + 1])
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
    const out: (number | 'ellipsis')[] = []
    let prev = 0
    for (const p of sorted) {
      if (prev && p - prev > 1) out.push('ellipsis')
      out.push(p)
      prev = p
    }
    return out
  })()

  return (
    <div className="catalogue-layout">
      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className="filter-panel">
        <button
          className="filter-mobile-toggle"
          onClick={() => setMobileFiltersOpen((o) => !o)}
          aria-expanded={mobileFiltersOpen}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {mobileFiltersOpen ? 'Hide filters' : 'Filter datasets'}
          {activeChips.length > 0 && <span className="filter-count-badge">{activeChips.length}</span>}
        </button>

        <div className={`filter-panel-inner${mobileFiltersOpen ? ' open' : ''}`}>
          <div className="filter-panel-header">
            <span className="filter-panel-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filters
            </span>
            {hasActiveFilters && (
              <button className="filter-clear-btn" onClick={clearAll}>Clear all</button>
            )}
          </div>

          <div className="filter-panel-body">
            {PRIMARY_FILTERS.map(renderFilterSection)}
            {showMore && MORE_FILTERS.map(renderFilterSection)}
            <button className="filter-more-btn" onClick={() => setShowMore((s) => !s)}>
              {showMore ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Fewer filters
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  More filters
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Results ───────────────────────────────────────── */}
      <div className="catalogue-results">
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
              placeholder="Search by title, landscape, theme, ID…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="toolbar-right">
            <label htmlFor="sort-select" className="sort-label">Sort by</label>
            <select
              id="sort-select"
              className="sort-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="status">By status</option>
            </select>

            <div className="view-toggle-group" role="group" aria-label="View mode">
              <button
                type="button"
                className={`view-toggle-btn${viewMode === 'card' ? ' active' : ''}`}
                onClick={() => setViewMode('card')}
                aria-pressed={viewMode === 'card'}
                aria-label="Grid view"
                title="Grid view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                type="button"
                className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                aria-label="List view"
                title="List view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="active-chips" role="list" aria-label="Active filters">
            {activeChips.map(({ key, value }) => (
              <span key={`${key}-${value}`} className="chip" role="listitem">
                {displayValue(key, value)}
                <button className="chip-remove" onClick={() => removeChip(key, value)} aria-label={`Remove filter: ${displayValue(key, value)}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
            <button className="chip-clear-all" onClick={clearAll}>Clear all</button>
          </div>
        )}

        <p className="results-count">
          Showing <strong>{pageItems.length}</strong> of {filtered.length} datasets
        </p>

        <details className="readiness-legend">
          <summary>What do “Raw”, “Processed” and “Validated” mean?</summary>
          <ul>
            {READINESS_ORDER.map((s) => (
              <li key={s}><span className={`badge badge-${s.toLowerCase()}`}>{s}</span> {READINESS_MEANING[s]}</li>
            ))}
            <li>{READINESS_NOTE}</li>
          </ul>
        </details>

        <DatasetGrid datasets={pageItems} base={base} viewMode={viewMode} onClearAll={hasActiveFilters ? clearAll : undefined} />

        {filtered.length > 0 && (
          <div className="pagination">
            <div className="pagination-nav">
              <button
                className="page-arrow"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              {pageItemsList.map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`gap-${i}`} className="page-ellipsis" aria-hidden="true">…</span>
                ) : (
                  <button
                    key={p}
                    className={`page-num${p === page ? ' active' : ''}`}
                    onClick={() => setPage(p)}
                    aria-current={p === page ? 'page' : undefined}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="page-arrow"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>

            <div className="per-page">
              <label htmlFor="per-page-select">Show</label>
              <select
                id="per-page-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
