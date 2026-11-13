import type { RecordSummary } from '../../lib/api/types'
import { NOT_SPECIFIED } from '../../lib/domain/facets'
import type { LabelBook } from '../../lib/domain/labels'
import { dataTypeIcon, datasetHref, joinLabels, periodText } from '../../lib/domain/present'
import { readinessBadge, readinessLabel, readinessTooltip } from '../../lib/domain/readiness'
import { DatasetTypeIcon } from './DatasetTypeIcon'
import type { ViewMode } from './ResultsToolbar'

interface Props {
  dataset: RecordSummary
  base: string
  labels: LabelBook
  /** 'card' = a tile in the grid (the default view); 'list' = the compact row. */
  variant?: ViewMode
}

/** A licence short enough for a tile: the SPDX id; anything else is given in full on the dataset page. */
function licenceShort(d: RecordSummary): string | null {
  const l = d.facets.license?.[0]
  if (!l || l === NOT_SPECIFIED) return null
  return l === 'other' ? 'Terms at the source' : l
}

function ReadinessBadge({ value }: { value: string | null | undefined }) {
  return (
    <span className={readinessBadge(value)} title={readinessTooltip(value)}>
      {readinessLabel(value)}
    </span>
  )
}

/** One result, as a tile or a row (Lizeth's design); the readiness badge is the only colour. */
export function DatasetCard({ dataset: d, base, labels, variant = 'card' }: Props) {
  const href = datasetHref(base, d.id)
  const kinds = d.facets.data_kind ?? []
  const kindText = joinLabels(labels, 'data_kind', kinds, 2)
  const where = joinLabels(labels, 'landscape', d.landscapes, 1) ?? joinLabels(labels, 'geography', d.geography, 2)
  const access = d.access ? labels.label('access', d.access) : null
  const period = periodText(d.period)
  const fromOther = d.source !== 'mosaic' ? labels.label('source', d.source) : null

  if (variant === 'card') {
    const line1 = [where, d.resolution].filter((x): x is string => !!x)
    const line2 = [access, period, licenceShort(d)].filter((x): x is string => !!x)
    return (
      <article className="ds-tile">
        <p className="ds-tile-top">
          <span className="ds-tile-type">
            <DatasetTypeIcon type={dataTypeIcon(kinds)} />
            {kindText ?? 'Dataset'}
          </span>
          <ReadinessBadge value={d.processing_status} />
        </p>
        <h3 className="ds-tile-title">
          <a href={href} className="ds-card-title-link">{d.title}</a>
        </h3>
        {(d.producer || fromOther) && (
          <p className="ds-tile-by">
            {d.producer && <>By {d.producer}</>}
            {d.producer && fromOther && ' · '}
            {fromOther && <em>via {fromOther}</em>}
          </p>
        )}
        {d.description && <p className="ds-tile-desc">{d.description}</p>}
        <div className="ds-tile-foot">
          {line1.length > 0 && <p>{line1.join(' · ')}</p>}
          {line2.length > 0 && <p>{line2.join(' · ')}</p>}
        </div>
      </article>
    )
  }

  const specs = [kindText, d.resolution, period, access].filter((x): x is string => !!x)
  const context = [
    joinLabels(labels, 'geography', d.geography, 2),
    joinLabels(labels, 'landscape', d.landscapes, 2),
    joinLabels(labels, 'theme', d.themes, 1),
    d.producer,
  ].filter((x): x is string => !!x)
  const isOpen = d.access === 'public' && !!d.access_url

  return (
    <article className="ds-card">
      <span className="ds-card-icon">
        <DatasetTypeIcon type={dataTypeIcon(kinds)} />
      </span>
      <div className="ds-card-main">
        <h3 className="ds-card-title">
          {/* stretched link: the title is the anchor, the whole row is clickable */}
          <a href={href} className="ds-card-title-link">{d.title}</a>
        </h3>
        <p className="ds-card-specs">
          <ReadinessBadge value={d.processing_status} />
          {specs.length > 0 && <span className="ds-spec-text">{specs.join(' · ')}</span>}
        </p>
        {d.description && <p className="ds-card-desc">{d.description}</p>}
        <p className="ds-card-meta">
          <span className="ds-meta-text">
            {context.join(' · ')}
            {fromOther && <> · <em>via {fromOther}</em></>}
          </span>
          {/* MOSAIC links to the data where it lives; it does not re-host it. */}
          {d.access_url && (
            <a href={d.access_url} className="ds-source-link" target="_blank" rel="noopener noreferrer" aria-label={`Go to source for ${d.title}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {isOpen ? 'Go to source' : 'Source link'}
            </a>
          )}
        </p>
      </div>
      <span className="ds-card-arrow" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </article>
  )
}
