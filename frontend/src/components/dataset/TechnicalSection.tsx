import type { RecordDetail } from '../../lib/api/types'
import { NOT_SPECIFIED } from '../../lib/domain/facets'
import type { LabelBook } from '../../lib/domain/labels'
import { joinLabels } from '../../lib/domain/present'
import { readinessLabel } from '../../lib/domain/readiness'
import { coverageOf, formatsOf, periodOf, resolutionOf } from './view'

interface Props {
  d: RecordDetail
  labels: LabelBook
  jsonUrl: string
  /** Bounding box of each living landscape (mosaic-api /v1/landscapes), for records without their own. */
  landscapeBoxes: Record<string, number[] | null | undefined>
}

const box = (b: number[]) => `W ${b[0]}, S ${b[1]}, E ${b[2]}, N ${b[3]}`

const row = (label: string, value: React.ReactNode) => (
  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
)

/** Technical metadata: spatial, temporal, data, processing and the full record (standard v0.2 fields). */
export function TechnicalSection({ d, labels, jsonUrl, landscapeBoxes }: Props) {
  const r = d.record
  const sp = r.spatial
  const t = r.temporal
  const freq = t?.update_frequency
  const geometry = (d.facets.geometry ?? []).filter((g) => g !== NOT_SPECIFIED)
  const bbox = (sp?.bbox ?? []) as unknown as number[] | number[][]
  const boxes = (Array.isArray(bbox[0]) ? bbox : bbox.length ? [bbox] : []) as number[][]
  const landBoxes = d.landscapes.map((c) => landscapeBoxes[c]).filter((b): b is number[] => !!b && b.length === 4)
  const formats = formatsOf(r)
  const structures = r.structures ?? []
  const steps = r.processing ?? []
  return (
    <section id="technical" className="dp-sec">
      <h2>Technical metadata</h2>
      <p className="dp-muted">The spatial, temporal and file detail behind the summaries on this page.</p>

      <h3>Spatial</h3>
      <dl className="dp-kv">
        {row('Coverage', coverageOf(d, labels) ?? 'Not specified')}
        {row('Living landscape', d.landscapes.length
          ? <>{d.landscapes.map((c) => `${labels.label('landscape', c)} (${c})`).join(', ')}{d.landscapes_derived ? ' — from the dataset extent' : ''}</>
          : 'Not specified')}
        {row('Country', joinLabels(labels, 'geography', sp?.geography ?? [], 20) ?? 'Not specified')}
        {row('Spatial resolution', resolutionOf(r) ?? 'Not specified')}
        {boxes.length > 0
          ? row('Bounding box', boxes.map(box).join('; '))
          : landBoxes.length > 0 &&
            row('Bounding box', <>{landBoxes.map(box).join('; ')} <span className="dp-small">(the living landscape's; the dataset's own extent is not recorded)</span></>)}
        {sp?.crs && row('Coordinate system', sp.crs)}
      </dl>

      <h3>Temporal</h3>
      <dl className="dp-kv">
        {row('Period covered', periodOf(r) ?? 'Not specified')}
        {t?.text && t.text !== periodOf(r) && row('As stated', t.text)}
        {freq && freq !== 'unknown' && row('Update frequency', freq[0].toUpperCase() + freq.slice(1))}
        {r.source_updated && row('Updated at the source', r.source_updated)}
      </dl>

      <h3>Data</h3>
      <dl className="dp-kv">
        {row('Data type', joinLabels(labels, 'data_kind', d.facets.data_kind ?? [], 5) ?? 'Not specified')}
        {geometry.length > 0 && row('Geometry', joinLabels(labels, 'geometry', geometry, 5))}
        {formats.length > 0 && row('Formats', formats.join(', '))}
        {row('Theme', joinLabels(labels, 'theme', r.themes ?? [], 20) ?? 'Not specified')}
        {row('Data entries', String((r.data ?? []).length))}
        {structures.length > 0 && row('Data dictionary', structures.map((s) => `${s.name}: ${(s.variables ?? []).length} variables`).join('; '))}
      </dl>

      <h3>Processing</h3>
      <dl className="dp-kv">
        {row('Readiness (declared)', readinessLabel(r.processing_status))}
      </dl>
      {steps.length > 0 ? (
        <ol className="dp-steps">
          {steps.map((s) => (
            <li key={s.id}>
              <p><strong>{s.id === 'source' ? 'Original generation' : s.id}</strong>{s.date && <span className="dp-muted"> · {s.date}</span>}</p>
              <p>{s.description}</p>
              {(s.derived_from ?? []).length > 0 && (
                <p className="dp-small">
                  From:{' '}
                  {(s.derived_from ?? []).map((src, i) => (
                    <span key={i}>
                      {i > 0 && '; '}
                      {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title ?? src.url}</a> : src.title ?? src.id}
                      {src.version && ` (${src.version})`}
                    </span>
                  ))}
                </p>
              )}
              {s.code?.url && (
                <p className="dp-small">Code: <a href={s.code.url} target="_blank" rel="noopener noreferrer">{s.code.url}</a>{s.code.version && ` @ ${s.code.version}`}</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="dp-muted">No processing steps have been registered for this dataset.</p>
      )}

      <h3>Full record</h3>
      <dl className="dp-kv">
        {row('Catalogue', d.provenance.record_url
          ? <a href={d.provenance.record_url} target="_blank" rel="noopener noreferrer">{d.provenance.source_name} ↗</a>
          : d.provenance.source_name)}
        {row('MOSAIC record', <a href={jsonUrl} target="_blank" rel="noopener noreferrer">JSON ↗</a>)}
        {d.same_as.length > 0 && row('Also described in', d.same_as.join(', '))}
        {r.created && row('Registered', r.created)}
        {r.updated && row('Last updated', r.updated)}
        {row('Harvested', new Date(d.provenance.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}
      </dl>
    </section>
  )
}
