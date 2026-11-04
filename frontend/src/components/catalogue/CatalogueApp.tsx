import { useMemo, useState } from 'react'
import { catalogue } from '../../lib/catalog'
import type { FacetKey } from '../../lib/domain/facets'
import { activeFilters, emptyQuery, toggleFilter, type CatalogueQuery } from '../../lib/domain/query'
import { useAsync } from '../../lib/ui/useAsync'
import { useCatalogueQuery } from '../../lib/ui/useCatalogueQuery'
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
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const overview = useAsync(() => repo.overview(), [repo])
  const results = useAsync(() => (ready ? repo.search(query) : new Promise<never>(() => {})), [repo, ready, query])

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
              <summary>What do “Complete” and “Incomplete” mean?</summary>
              <ul>
                <li><span className="badge badge-validated">Complete</span> The record has every field of the MOSAIC minimum: enough to find, understand, cite and reach the data.</li>
                <li><span className="badge badge-raw">Incomplete</span> Some of those fields are still missing; the dataset page lists them. The data itself may be fine.</li>
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
