import type { Dataset } from '../../utils/types'
import { DatasetTypeIcon } from './DatasetTypeIcon'

const STATUS_BADGE: Record<string, string> = {
  'Raw':       'badge badge-raw',
  'Processed': 'badge badge-processed',
  'Validated': 'badge badge-validated',
}

const STATUS_TOOLTIP: Record<string, string> = {
  'Raw':       'Metadata registered; dataset not yet reviewed.',
  'Processed': 'Dataset prepared, harmonized or structured for use.',
  'Validated': 'Metadata and spatial information checked by the MOSAIC team.',
}

interface Props {
  dataset: Dataset
  base: string
}

export function DatasetCard({ dataset, base }: Props) {
  const detailUrl = `${base}/catalogue/${dataset.id}`
  const isOpen = dataset.access_level === 'Open' && !!dataset.download_url
  const formats = dataset.formats ?? []

  // Colour emphasis is reserved for readiness status. Everything else that
  // used to be a badge (type, resolution, year) is plain text, dot-separated,
  // so the row reads as a record rather than a wall of pills.
  const specs = [
    dataset.data_type,
    dataset.spatial_resolution && dataset.spatial_resolution !== 'N/A' ? dataset.spatial_resolution : null,
    dataset.temporal_coverage,
  ].filter(Boolean) as string[]

  const context = [
    dataset.country,
    dataset.landscape_name ?? dataset.living_landscape,
    dataset.mfl_theme,
    dataset.source,
  ].filter(Boolean) as string[]

  return (
    <article className="ds-card">
      <span className="ds-card-icon">
        <DatasetTypeIcon type={dataset.data_type} />
      </span>

      <div className="ds-card-main">
        <h3 className="ds-card-title">
          {/* Stretched-link: the title is the real anchor; ::after overlay makes
              the whole row clickable while keeping new-tab / keyboard behaviour. */}
          <a href={detailUrl} className="ds-card-title-link">{dataset.title}</a>
        </h3>

        <p className="ds-card-specs">
          <span
            className={STATUS_BADGE[dataset.readiness_status] ?? 'badge badge-raw'}
            title={STATUS_TOOLTIP[dataset.readiness_status]}
          >
            {dataset.readiness_status}
          </span>
          {specs.length > 0 && <span className="ds-spec-text">{specs.join(' · ')}</span>}
        </p>

        {dataset.description && (
          <p className="ds-card-desc">{dataset.description}</p>
        )}

        <p className="ds-card-meta">
          <span className="ds-meta-text">{context.join(' · ')}</span>

          {/* MOSAIC connects to sources rather than re-hosting: only show a
              source link when the record carries a real external download_url. */}
          {dataset.download_url && (
            <a
              href={dataset.download_url}
              className="ds-source-link"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Go to source for ${dataset.title}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {isOpen ? 'Go to source' : 'Source link'}
              {formats.length > 0 && <span className="ds-formats">({formats.join(', ')})</span>}
            </a>
          )}
        </p>
      </div>

      {/* Discreet affordance only — the title is the real link. */}
      <span className="ds-card-arrow" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </article>
  )
}
