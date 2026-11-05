import { useState } from 'react'
import type { FacetCounts } from '../../lib/api/types'
import type { FacetKey, Filters } from '../../lib/domain/facets'
import type { LabelBook } from '../../lib/domain/labels'
import { FilterGroup } from './FilterGroup'
import { PRIMARY_FILTERS, type FilterDef } from './filters'

interface Props {
  catalogueFacets: FacetCounts
  resultFacets: FacetCounts
  filters: Filters
  labels: LabelBook
  activeCount: number
  canClear: boolean
  onToggle: (facet: FacetKey, value: string) => void
  onClearAll: () => void
}

export function FilterPanel({ catalogueFacets, resultFacets, filters, labels, activeCount, canClear, onToggle, onClearAll }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const group = (def: FilterDef) => (
    <FilterGroup
      key={def.key}
      def={def}
      values={Object.keys(catalogueFacets[def.key] ?? {})}
      counts={resultFacets[def.key] ?? {}}
      selected={filters[def.key] ?? []}
      labels={labels}
      onToggle={(v) => onToggle(def.key, v)}
    />
  )
  return (
    <aside className="filter-panel">
      <button className="filter-mobile-toggle" onClick={() => setMobileOpen((o) => !o)} aria-expanded={mobileOpen}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {mobileOpen ? 'Hide filters' : 'Filter datasets'}
        {activeCount > 0 && <span className="filter-count-badge">{activeCount}</span>}
      </button>

      <div className={`filter-panel-inner${mobileOpen ? ' open' : ''}`}>
        <div className="filter-panel-header">
          <span className="filter-panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters
          </span>
          {canClear && <button className="filter-clear-btn" onClick={onClearAll}>Clear all</button>}
        </div>

        <div className="filter-panel-body">
          {PRIMARY_FILTERS.map(group)}
        </div>
      </div>
    </aside>
  )
}
