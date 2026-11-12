import type { RecordDetail } from '../../lib/api/types'
import { ROLE_LABEL, recordReference, statedCitation } from './view'

/** Citation & contacts: the record's own citation (never made up), funding, publications, everyone named. */
export function CitationSection({ d, base }: { d: RecordDetail; base: string }) {
  const r = d.record
  const cite = statedCitation(r)
  const origin = typeof location === 'undefined' ? '' : location.origin
  const pubs = r.related_publications ?? []
  return (
    <section id="citation" className="dp-sec">
      <h2>Citation &amp; contacts</h2>
      <div className="dp-cite">
        <h3>How to cite</h3>
        {cite ? (
          <p className="dp-cite-text">{cite}</p>
        ) : (
          <>
            <p>
              No citation is registered for this dataset yet. Cite the data as its source asks (see Access &amp; use), or ask the contact below.
              To point to this catalogue record, use:
            </p>
            <p className="dp-cite-text">{recordReference(d, base, origin)}</p>
          </>
        )}
        {r.doi && <p>DOI: <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer">{r.doi}</a></p>}
      </div>

      <h3>Contacts</h3>
      <p className="dp-muted">Who holds this dataset, and who to reach about it.</p>
      <ul className="dp-contacts">
        {(r.contact ?? []).length === 0 && (
          <li><span className="dp-contact-role">Point of contact</span><span>Via the MOSAIC coordination team</span></li>
        )}
        {(r.contact ?? []).map((c, i) => (
          <li key={i}>
            <span className="dp-contact-role">{(c.roles ?? []).map((x) => ROLE_LABEL[x] ?? x).join(', ') || 'Contact'}</span>
            {c.name && <span>{c.name}</span>}
            {c.organization && <span>{c.organization}</span>}
            {c.email && <a href={`mailto:${c.email}?subject=${encodeURIComponent(`MOSAIC ${d.id}`)}`}>{c.email}</a>}
          </li>
        ))}
      </ul>

      {(r.funding ?? []).length > 0 && (
        <>
          <h3>Funding</h3>
          <ul className="dp-plain">
            {(r.funding ?? []).map((f, i) => (
              <li key={i}>{f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer">{f.name}</a> : f.name}{f.award && ` — ${f.award}`}</li>
            ))}
          </ul>
        </>
      )}

      {pubs.length > 0 && (
        <>
          <h3>Related publications</h3>
          <ul className="dp-plain">
            {pubs.map((p, i) => (
              <li key={i}>
                {p.citation?.text ?? p.citation?.title ?? p.doi}
                {p.doi && <> — <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer">{p.doi}</a></>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
