import type { RecordSummary } from '../../lib/api/types'
import type { LabelBook } from '../../lib/domain/labels'
import { DatasetCard } from './DatasetCard'
import type { ViewMode } from './ResultsToolbar'

interface Props {
  datasets: RecordSummary[]
  base: string
  labels: LabelBook
  viewMode?: ViewMode
  onClearAll?: () => void
}

export function DatasetGrid({ datasets, base, labels, viewMode = 'card', onClearAll }: Props) {
  if (datasets.length === 0) {
    return (
      <div className="empty-state">
        <h3>No datasets match your filters</h3>
        <p>
          Try removing one filter, or search by country. Know of a dataset that should be here?{' '}
          <a href={`${base}/about#contribute`}>Register it</a>.
        </p>
        {onClearAll && (
          <button type="button" className="empty-state-clear" onClick={onClearAll}>Clear all filters</button>
        )}
      </div>
    )
  }
  return (
    <div className={`ds-results ${viewMode === 'card' ? 'ds-results--grid' : 'ds-results--list'}`}>
      {datasets.map((d) => (
        <DatasetCard key={d.id} dataset={d} base={base} labels={labels} variant={viewMode} />
      ))}
    </div>
  )
}
