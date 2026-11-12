import { useEffect, useMemo, useState } from 'react'
import { catalogue } from '../../lib/catalog'
import type { FacetKey } from '../../lib/domain/facets'
import { activeFilters, emptyQuery, toggleFilter, type CatalogueQuery } from '../../lib/domain/query'
import { useAsync } from '../../lib/ui/useAsync'
import { useCatalogueQuery } from '../../lib/ui/useCatalogueQuery'
import { NOT_STATED, READINESS_MEANING, READINESS_NOTE, READINESS_ORDER, readinessBadge, readinessLabel } from '../../lib/domain/readiness'
import { ActiveChips } from './ActiveChips'
import { DatasetGrid } from './DatasetGrid'
import { FilterPanel } from './FilterPanel'
import { LoadError, Loading } from './LoadState'
import { Pagination } from './Pagination'
import { ResultsToolbar, type ViewMode } from './ResultsToolbar'

interface Props {
  base: string
}

/**
 * Catalogue page container: owns the query state and talks to the repository.
 * Every child is presentational (props in, events out), so each can change or be tested alone.
 */
export function CatalogueApp({ base }: Props) {
  const repo = catalogue()
  const [query, setQuery, ready] = useCatalogueQuery()
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const overview = useAsync(() => repo.overview(), [repo])
  const results = useAsync(() => (ready ? repo.search(query) : new Promise<never>(() => {})), [repo, ready, query])

  // Values from links are written as their labels or in any case ("Validated", "Perú"): once the labels
  // are known, the query holds the canonical values, so checkboxes and counts match them.
  useEffect(() => {
    if (overview.status !== 'ok' || !ready) return
    const { filters } = overview.data.labels.resolve(query.filters)
    if (JSON.stringify(filters) !== JSON.stringify(query.filters)) setQuery({ ...query, filters })
  }, [overview, ready, query, setQuery])

  const chips = useMemo(() => activeFilters(query), [query])
  const hasActive = chips.length > 0 || query.text.trim().length > 0
  const update = (patch: Partial<CatalogueQuery>) => setQuery({ ...query, page: 1, ...patch })
  const toggle = (facet: FacetKey, value: string) => setQuery(toggleFilter(query, facet, value))
  const clearAll = () => setQuery({ ...emptyQuery(), pageSize: query.pageSize })

  if (overview.status === 'error') return <LoadError error={overview.error} onRetry={overview.retry} />
  if (overview.status === 'loading') return <Loading />
  const { labels, facets } = overview.data
  const res = results.status === 'ok' ? results.data : null

  return (
    <div className="catalogue-layout">
      <FilterPanel
        catalogueFacets={facets}
        resultFacets={res?.facets ?? facets}
        filters={query.filters}
        labels={labels}
        activeCount={chips.length}
        canClear={hasActive}
        onToggle={toggle}
        onClearAll={clearAll}
      />

      <div className="catalogue-results">
        <ResultsToolbar
          text={query.text}
          sort={query.sort}
          viewMode={viewMode}
          onText={(text) => update({ text, sort: text.trim() && query.sort === 'recent' ? 'relevance' : !text.trim() && query.sort === 'relevance' ? 'recent' : query.sort })}
          onSort={(sort) => update({ sort })}
          onViewMode={setViewMode}
        />

        <ActiveChips chips={chips} labels={labels} onRemove={toggle} onClearAll={clearAll} />

        {results.status === 'error' ? (
          <LoadError error={results.error} onRetry={results.retry} />
        ) : !res ? (
          <Loading />
        ) : (
          <>
            <p className="results-count">
              Showing <strong>{res.items.length}</strong> of {res.total} datasets
            </p>
            {res.warnings.length > 0 && (
              <p className="results-count" role="note">{res.warnings.join('; ')}</p>
            )}

            <details className="readiness-legend">
              <summary>What do “Raw”, “Processed” and “Validated” mean?</summary>
              <ul>
                {READINESS_ORDER.map((r) => (
                  <li key={r}><span className={readinessBadge(r)}>{readinessLabel(r)}</span> {READINESS_MEANING[r]}</li>
                ))}
                <li><span className={readinessBadge(null)}>{NOT_STATED}</span> The contributor did not state it, or the catalogue it comes from has no such field.</li>
                <li>{READINESS_NOTE}</li>
              </ul>
            </details>

            <DatasetGrid datasets={res.items} base={base} labels={labels} viewMode={viewMode} onClearAll={hasActive ? clearAll : undefined} />
            <Pagination
              page={query.page}
              pageSize={query.pageSize}
              total={res.total}
              onPage={(page) => setQuery({ ...query, page })}
              onPageSize={(pageSize) => update({ pageSize })}
            />
          </>
        )}
      </div>
    </div>
  )
}
