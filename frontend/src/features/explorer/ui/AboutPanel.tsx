/** About & sources: the explorer's credits and the source, period, licence and citation of each layer. */
import type { SourceEntry } from '../domain/config'

interface Props {
  intro?: string
  licence?: string
  sources: SourceEntry[]
  report?: string
  credits: { name: string; role?: string; url?: string }[]
  recordHref: (gid: string) => string
}

export function AboutPanel({ intro, licence, sources, report, credits, recordHref }: Props) {
  return (
    <>
      <div className="about-brand">
        {intro && <p>{intro}</p>}
        {credits.map((c) => (
          <p key={c.name}>
            {c.url ? <a href={c.url}>{c.name}</a> : c.name}
            {c.role ? ` — ${c.role}` : ''}
          </p>
        ))}
        {report && (
          <p>
            <a href={report} target="_blank" rel="noopener noreferrer">
              Full data report
            </a>
          </p>
        )}
        {licence && <p className="p-meta">{licence}</p>}
      </div>
      {sources.length === 0 && <div className="empty">No sources listed for this explorer.</div>}
      {sources.map((s) => (
        <div className="source-block" key={s.id}>
          <h3>
            {s.title} {s.placeholder && <span className="pill restricted">placeholder</span>}
          </h3>
          <p className="p-meta">{[s.source, s.period, s.units, s.licence].filter(Boolean).join(' · ')}</p>
          {s.citation && <p className="p-meta">{s.citation}</p>}
          {s.attribution && <p className="p-meta">{s.attribution}</p>}
          {s.caveats && <p className="p-meta">{s.caveats}</p>}
          {s.record && (
            <p className="p-meta">
              <a href={recordHref(s.record)}>Catalogue record</a>
            </p>
          )}
        </div>
      ))}
    </>
  )
}
