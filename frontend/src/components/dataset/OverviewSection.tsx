import type { RecordDetail } from '../../lib/api/types'
import type { LabelBook } from '../../lib/domain/labels'
import { NOT_STATED, READINESS_MEANING, READINESS_NOTE, READINESS_ORDER, isReadiness, readinessBadge, readinessLabel } from '../../lib/domain/readiness'

export function OverviewSection({ d, labels }: { d: RecordDetail; labels: LabelBook }) {
  const r = d.record
  const keywords = (r.keywords ?? []).map((k) => (typeof k === 'string' ? k : k.term))
  const tags = [
    ...(r.themes ?? []).map((t) => labels.label('theme', t)),
    ...(d.facets.data_kind ?? []).filter((k) => k !== 'not_specified').map((k) => labels.label('data_kind', k)),
    ...(r.spatial?.geography ?? []).filter((g) => g !== 'global').map((g) => labels.label('geography', g)),
    ...keywords,
  ]
  const status = r.processing_status
  const uses = r.usage?.intended_uses ?? []
  const avoid = r.usage?.not_recommended_for ?? []
  return (
    <section id="overview" className="dp-sec">
      <h2>Overview</h2>
      {r.description ? <p className="dp-desc">{r.description}</p> : <p className="dp-muted">No description has been registered for this dataset yet.</p>}
      {r.note && <p className="dp-muted">{r.note}</p>}
      {tags.length > 0 && (
        <ul className="dp-tags" aria-label="Themes and keywords">
          {tags.map((t, i) => <li key={`${t}-${i}`}>{t}</li>)}
        </ul>
      )}

      {(uses.length > 0 || avoid.length > 0) && (
        <>
          <h3>Uses</h3>
          {uses.length > 0 && <ul>{uses.map((u) => <li key={u}>{u}</li>)}</ul>}
          {avoid.length > 0 && (
            <>
              <p className="dp-muted">Not recommended for:</p>
              <ul>
                {avoid.map((a) => (
                  <li key={a.use}><strong>{a.use}</strong> — {a.reason}{a.use_instead ? ` Use instead: ${a.use_instead}.` : ''}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div className="dp-note">
        <h3>Readiness: {readinessLabel(status)}</h3>
        <p>
          {isReadiness(status) ? READINESS_MEANING[status] : 'The contributor did not state how far the data has been processed, or its catalogue has no such field.'}{' '}
          {READINESS_NOTE}
        </p>
        <details>
          <summary>What the statuses mean</summary>
          <ul>
            {READINESS_ORDER.map((s) => (
              <li key={s}><span className={readinessBadge(s)}>{readinessLabel(s)}</span> {READINESS_MEANING[s]}</li>
            ))}
            <li><span className={readinessBadge(null)}>{NOT_STATED}</span> Not declared for this record.</li>
          </ul>
        </details>
      </div>

    </section>
  )
}
