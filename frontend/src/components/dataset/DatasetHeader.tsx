import type { RecordDetail } from '../../lib/api/types'
import type { LabelBook } from '../../lib/domain/labels'
import { ACCESS_BADGE, ACCESS_LABEL } from '../../lib/domain/present'
import { readinessBadge, readinessLabel, readinessTooltip } from '../../lib/domain/readiness'
import { correctionLinks, licenseShort, producers } from './view'

interface Props {
  d: RecordDetail
  labels: LabelBook
  base: string
  jsonUrl: string
}

/** What it is, who it is from, where it belongs, what you can do (approved design). */
export function DatasetHeader({ d, labels, base, jsonUrl }: Props) {
  const r = d.record
  const by = producers(r)
  const geo = (r.spatial?.geography ?? []).filter((g) => g !== 'global')
  const fix = correctionLinks(d)
  return (
    <header className="dp-head">
      <h1 className="dp-title">{r.title ?? d.local_id}</h1>
      {by && <p className="dp-by">{by}</p>}
      <p className="dp-part">
        Part of:{' '}
        {d.landscapes.length > 0
          ? d.landscapes.map((c, i) => (
              <span key={c}>
                {i > 0 && ', '}
                <a href={`${base}/landscapes#${c}`}>{labels.label('landscape', c)}</a>
              </span>
            ))
          : <span>{geo.length ? 'no living landscape' : 'Global'}</span>}
        {d.landscapes_derived && d.landscapes.length > 0 && <span className="dp-part-country"> (from the dataset extent)</span>}
        {geo.length > 0 && <span className="dp-part-country"> · {geo.map((g) => labels.label('geography', g)).join(', ')}</span>}
        {d.source !== 'mosaic' && <span className="dp-part-country"> · via {d.provenance.source_name}</span>}
      </p>
      <dl className="dp-meta">
        <div><dt>Record</dt><dd>{d.id}</dd></div>
        <div><dt>License</dt><dd>{licenseShort(r)}</dd></div>
        <div>
          <dt>Readiness</dt>
          <dd><span className={readinessBadge(r.processing_status)} title={readinessTooltip(r.processing_status)}>{readinessLabel(r.processing_status)}</span></dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd><span className={r.access ? ACCESS_BADGE[r.access] : 'badge badge-internal'}>{r.access ? ACCESS_LABEL[r.access] : 'Not specified'}</span></dd>
        </div>
      </dl>
      <div className="dp-actions">
        <a className="btn btn-primary" href="#access">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Access the data
        </a>
        <a className="btn btn-secondary" href={jsonUrl} target="_blank" rel="noopener noreferrer">Metadata (JSON)</a>
        {fix && (
          <>
            <a className="dp-action-link" href={fix.edit} target="_blank" rel="noopener noreferrer">{fix.atSource ? `Suggest an edit at ${d.provenance.source_name}` : 'Suggest an edit'} ↗</a>
            {!fix.atSource && <a className="dp-action-link" href={fix.problem} target="_blank" rel="noopener noreferrer">Report a problem ↗</a>}
          </>
        )}
      </div>
    </header>
  )
}
