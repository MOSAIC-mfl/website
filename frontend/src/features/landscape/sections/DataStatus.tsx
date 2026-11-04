/**
 * kind: data-status - what the catalogue holds for the landscape and what is missing (a gap
 * analysis): completeness, data types, themes, access, and the minimum fields records still lack.
 */
import { catalogue } from '../../../lib/catalog'
import { useAsync } from '../../../lib/ui/useAsync'
import type { SectionProps } from './types'

function Bars({ title, counts, total, label }: { title: string; counts: Record<string, number>; total: number; label: (v: string) => string }) {
  const rows = Object.entries(counts)
  if (!rows.length) return null
  return (
    <div className="lp-bars">
      <h3>{title}</h3>
      <ul>
        {rows.map(([k, n]) => (
          <li key={k}>
            <span className="lp-bar-label">{label(k)}</span>
            <span className="lp-bar-track" aria-hidden="true">
              <span className="lp-bar-fill" style={{ width: `${total ? (100 * n) / total : 0}%` }} />
            </span>
            <span className="lp-bar-n">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  keywords: 'Keywords',
  citation: 'How to cite',
  access_note: 'How to request access',
  license: 'Licence',
  contacts: 'Contact',
  data: 'Access point',
}

export function DataStatusSection({ page, base }: SectionProps) {
  const labels = useAsync(async () => (await catalogue().overview()).labels, [])
  const ds = page.data_status
  const lab = (facet: string) => (v: string) => (labels.status === 'ok' ? labels.data.label(facet, v) : v)
  const missing = Object.entries(ds.missing_minimum)
  const incomplete = `${base}/catalogue/?landscape=${encodeURIComponent(page.code)}&status=incomplete`
  if (!ds.total) return <p className="lp-empty">No dataset of the catalogue covers this landscape yet.</p>
  return (
    <div className="lp-status">
      <div className="lp-status-head">
        <p>
          <strong>{ds.total}</strong> datasets cover this landscape: <strong>{ds.complete}</strong> with complete metadata,{' '}
          <strong>{ds.incomplete}</strong> still missing part of the minimum. {ds.total - ds.stated > 0 && `${ds.total - ds.stated} of them are included because their area covers it.`}
        </p>
        <div className="lp-completeness" role="img" aria-label={`${ds.complete} of ${ds.total} complete`}>
          <span style={{ width: `${(100 * ds.complete) / ds.total}%` }} />
        </div>
      </div>
      <div className="lp-status-grid">
        <Bars title="Type of data" counts={ds.by_kind} total={ds.total} label={lab('data_kind')} />
        <Bars title="Themes" counts={ds.by_theme} total={ds.total} label={lab('theme')} />
        <Bars title="Access" counts={ds.by_access} total={ds.total} label={lab('access')} />
      </div>
      {missing.length > 0 && (
        <div className="lp-gaps">
          <h3>What the records still need</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Minimum field</th>
                <th scope="col">Datasets missing it</th>
              </tr>
            </thead>
            <tbody>
              {missing.map(([f, n]) => (
                <tr key={f}>
                  <td>{FIELD_LABELS[f] ?? f}</td>
                  <td>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <a href={incomplete}>See the datasets with incomplete metadata &rarr;</a>
          </p>
        </div>
      )}
    </div>
  )
}
