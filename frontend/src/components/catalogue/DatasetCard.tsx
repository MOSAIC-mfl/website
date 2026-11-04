import type { ResourceSummary } from '../../lib/api/types'
import type { LabelBook } from '../../lib/domain/labels'
import {
  COMPLETENESS_BADGE,
  COMPLETENESS_LABEL,
  COMPLETENESS_TOOLTIP,
  dataTypeIcon,
  datasetHref,
  joinLabels,
  primarySpecs,
} from '../../lib/domain/present'
import { DatasetTypeIcon } from './DatasetTypeIcon'

interface Props {
  dataset: ResourceSummary
  base: string
  labels: LabelBook
}

/** One result row/card. Same markup and classes as the approved design; new MOSAIC fields fill it. */
export function DatasetCard({ dataset: d, base, labels }: Props) {
  const isOpen = d.access === 'public' && !!d.access_url
  const specs = primarySpecs(d, labels)
  const context = [
    joinLabels(labels, 'geography', d.geography, 2),
    joinLabels(labels, 'landscape', d.landscapes, 2),
    joinLabels(labels, 'theme', d.themes, 1),
    d.producer,
  ].filter((x): x is string => !!x)
  const fromOther = d.source !== 'mosaic' ? labels.label('source', d.source) : null

  return (
    <article className="ds-card">
      <span className="ds-card-icon">
        <DatasetTypeIcon type={dataTypeIcon(d.facets.data_kind)} />
      </span>

      <div className="ds-card-main">
        <h3 className="ds-card-title">
          <a href={datasetHref(base, d.id)} className="ds-card-title-link">{d.title}</a>
        </h3>

        <p className="ds-card-specs">
          <span className={COMPLETENESS_BADGE[d.status] ?? 'badge badge-raw'} title={COMPLETENESS_TOOLTIP[d.status]}>
            {COMPLETENESS_LABEL[d.status] ?? d.status}
          </span>
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
