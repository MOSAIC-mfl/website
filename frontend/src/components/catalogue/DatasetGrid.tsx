import type { Dataset } from '../../utils/types'
import { DatasetCard } from './DatasetCard'

interface Props {
  datasets: Dataset[]
  base: string
  viewMode?: 'card' | 'list'
  onClearAll?: () => void
}

export function DatasetGrid({ datasets, base, viewMode = 'list', onClearAll }: Props) {
  if (datasets.length === 0) {
    return (
      <div className="empty-state">
        <h3>No datasets match your filters</h3>
        <p>Try removing one filter, or search by country. Know of a dataset that should be here? <a href={`${base}/about#contribute`}>Register it</a>.</p>
        {onClearAll && (
          <button type="button" className="empty-state-clear" onClick={onClearAll}>
            Clear all filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`ds-results ${viewMode === 'card' ? 'ds-results--grid' : 'ds-results--list'}`}>
      {datasets.map((d) => (
        <DatasetCard key={d.id} dataset={d} base={base} />
      ))}
    </div>
  )
}
