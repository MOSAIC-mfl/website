import type { LabelBook } from '../../lib/domain/labels'
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
  onToggle: (value: string) => void
}

export function FilterGroup({ def, values, counts, selected, labels, onToggle }: Props) {
  if (values.length === 0) return null
  const options = [...values].sort((a, b) => labels.label(def.key, a).localeCompare(labels.label(def.key, b)))
  return (
    <fieldset className="filter-group">
      <legend className="filter-group-legend">
        <span className={`filter-group-icon filter-group-icon--${def.key}`}>{FILTER_ICON[def.key]}</span>
        {def.label}
      </legend>
      <ul className="filter-options">
        {options.map((opt) => {
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
  )
}
