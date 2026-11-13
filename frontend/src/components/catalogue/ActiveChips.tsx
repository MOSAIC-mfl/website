import type { FacetKey } from '../../lib/domain/facets'
import type { LabelBook } from '../../lib/domain/labels'

interface Props {
  chips: { facet: FacetKey; value: string }[]
  labels: LabelBook
  onRemove: (facet: FacetKey, value: string) => void
  onClearAll: () => void
}

export function ActiveChips({ chips, labels, onRemove, onClearAll }: Props) {
  if (chips.length === 0) return null
  return (
    <div className="active-chips" role="list" aria-label="Active filters">
      {chips.map(({ facet, value }) => {
        const label = labels.label(facet, value)
        return (
          <span key={`${facet}-${value}`} className="chip" role="listitem">
            {label}
            <button className="chip-remove" onClick={() => onRemove(facet, value)} aria-label={`Remove filter: ${label}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        )
      })}
      <button className="chip-clear-all" onClick={onClearAll}>Clear all</button>
    </div>
  )
}
