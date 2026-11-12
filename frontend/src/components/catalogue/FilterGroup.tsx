import type { LabelBook } from '../../lib/domain/labels'
import { READINESS_FACET, readinessRank } from '../../lib/domain/readiness'
import { key } from '../../lib/domain/text'
import type { FilterDef } from './filters'
import { FILTER_ICON } from './icons'

interface Props {
  def: FilterDef
  /** Every value of this facet in the catalogue (so options never disappear). */
  values: string[]
  /** Count of each value among the current results. */
  counts: Record<string, number>
  selected: string[]
  labels: LabelBook
  open: boolean
  onOpenChange: () => void
  onToggle: (value: string) => void
}

/** Sorted by what is shown: readiness from Raw to Validated (then Not stated), the rest by label. */
export function sortOptions(facet: string, values: string[], labels: LabelBook): string[] {
  return [...values].sort((a, b) =>
    facet === READINESS_FACET ? readinessRank(a) - readinessRank(b) : labels.label(facet, a).localeCompare(labels.label(facet, b)),
  )
}

/** One folding filter group (approved design): a header button with icon, label and count, then the options. */
export function FilterGroup({ def, values, counts, selected, labels, open, onOpenChange, onToggle }: Props) {
  if (values.length === 0) return null
  const bodyId = `fg-${def.key}`
  return (
    <div className="filter-group" data-open={open}>
      <h3 className="filter-group-head">
        <button type="button" className="filter-group-toggle" aria-expanded={open} aria-controls={bodyId} onClick={onOpenChange}>
          <span className={`filter-group-icon filter-group-icon--${def.key}`}>{FILTER_ICON[def.key]}</span>
          <span className="filter-group-label">{def.label}</span>
          {selected.length > 0 && (
            <span className="filter-group-count" aria-label={`${selected.length} selected`}>{selected.length}</span>
          )}
          <svg className="filter-group-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </h3>
      <div className="filter-group-body" id={bodyId}>
        <fieldset className="filter-group-inner">
          <legend className="sr-only">{def.label}</legend>
          <ul className="filter-options">
            {sortOptions(def.key, values, labels).map((opt) => {
              const inputId = `f-${def.key}-${key(opt)}`
              return (
                <li key={opt} className="filter-option">
                  <input type="checkbox" id={inputId} checked={selected.includes(opt)} onChange={() => onToggle(opt)} />
                  <label htmlFor={inputId}>
                    <span>{labels.label(def.key, opt)}</span>
                    <span className="filter-count">({counts[opt] ?? 0})</span>
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
