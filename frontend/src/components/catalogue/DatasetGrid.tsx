import type { ResourceSummary } from '../../lib/api/types'
import type { LabelBook } from '../../lib/domain/labels'
import { DatasetCard } from './DatasetCard'
import type { ViewMode } from './ResultsToolbar'

interface Props {
  datasets: ResourceSummary[]
  base: string
  labels: LabelBook
  viewMode?: ViewMode
  onClearAll?: () => void
}

export function DatasetGrid({ datasets, base, labels, viewMode = 'list', onClearAll }: Props) {
  if (datasets.length === 0) {
    return (
      <div className="empty-state">
        <h3>No datasets match your filters</h3>
        <p>Try removing one filter, or search by country.</p>
        {onClearAll && (
          <button type="button" className="empty-state-clear" onClick={onClearAll}>Clear all filters</button>
        )}
      </div>
    )
  }
  return (
    <div className={`ds-results ${viewMode === 'card' ? 'ds-results--grid' : 'ds-results--list'}`}>
      {datasets.map((d) => (
        <DatasetCard key={d.id} dataset={d} base={base} labels={labels} />
      ))}
    </div>
  )
}
