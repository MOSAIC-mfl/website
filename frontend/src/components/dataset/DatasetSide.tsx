import type { RecordDetail, RecordSummary } from '../../lib/api/types'
import type { LabelBook } from '../../lib/domain/labels'
import { datasetHref, joinLabels } from '../../lib/domain/present'
import { coverageOf, periodOf, primaryAccess, resolutionOf, urlOf } from './view'

/** Side column: the facts at a glance, and where to go next. */
export function DatasetSide({ d, labels, base, related }: { d: RecordDetail; labels: LabelBook; base: string; related: RecordSummary[] }) {
  const r = d.record
  const facts = [
    ['Coverage', coverageOf(d, labels)],
    ['Resolution', resolutionOf(r)],
    ['Temporal', periodOf(r)],
    ['Data type', joinLabels(labels, 'data_kind', d.facets.data_kind ?? [], 3)],
    ['Theme', joinLabels(labels, 'theme', r.themes ?? [], 3)],
    ['Catalogue', d.provenance.source_name],
  ].filter(([, v]) => v) as [string, string][]
  const source = primaryAccess(r)
  const landscape = d.landscapes[0]
  return (
    <aside className="dp-side" aria-label="Quick facts and related">
      <section className="dp-card">
        <h2>Quick facts</h2>
        <dl className="dp-facts">
          {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      {related.length > 0 && (
        <section className="dp-card">
          <h2>Related datasets</h2>
          <ul className="dp-links">
            {related.map((x) => (
              <li key={x.id}>
                <a href={datasetHref(base, x.id)}>{x.title}</a>
                <span>{[joinLabels(labels, 'landscape', x.landscapes, 1), joinLabels(labels, 'theme', x.themes, 1)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dp-card">
        <h2>Related links</h2>
        <ul className="dp-links">
          {landscape && <li><a href={`${base}/landscapes#${landscape}`}>{labels.label('landscape', landscape)}: the landscape</a></li>}
          {landscape && <li><a href={`${base}/catalogue/?landscape=${encodeURIComponent(landscape)}`}>All datasets for {labels.label('landscape', landscape)}</a></li>}
          {source && urlOf(source) && <li><a href={urlOf(source)} target="_blank" rel="noopener noreferrer">The data at its source ↗</a></li>}
          {d.provenance.record_url && <li><a href={d.provenance.record_url} target="_blank" rel="noopener noreferrer">The record in {d.provenance.source_name} ↗</a></li>}
        </ul>
      </section>
    </aside>
  )
}
