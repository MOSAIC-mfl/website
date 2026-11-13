import type { AccessPoint, RecordDetail } from '../../lib/api/types'
import type { LabelBook } from '../../lib/domain/labels'
import { ACCESS_BADGE, ACCESS_LABEL } from '../../lib/domain/present'
import { contactLine, formatName, formatsOf, licenseText, licenseUrl, METHOD_ACTION, pointOfContact, primaryAccess, spdxOf, urlOf } from './view'

function AccessPoints({ points, recordAccess, labels }: { points: AccessPoint[]; recordAccess?: string; labels: LabelBook }) {
  if (points.length === 0) return null
  return (
    <table className="data-table">
      <tbody>
        {points.map((p, i) => (
          <tr key={i}>
            <td>
              <strong>{p.name}</strong>
              {p.description && <><br /><span className="dp-small">{p.description}</span></>}
              {(p.kind || p.media_type || p.file_size) && (
                <><br /><span className="dp-small dp-muted">{[p.kind && labels.label('data_kind', p.kind), p.media_type && formatName(p.media_type), p.file_size].filter(Boolean).join(' · ')}</span></>
              )}
            </td>
            <td>
              {urlOf(p) && p.access_method !== 'request' ? (
                <a href={urlOf(p)} target="_blank" rel="noopener noreferrer">{METHOD_ACTION[p.access_method ?? 'landing_page']} ↗</a>
              ) : (
                METHOD_ACTION[p.access_method ?? 'request'] ?? 'Not specified'
              )}
              {p.access && p.access !== recordAccess && <><br /><span className={ACCESS_BADGE[p.access]}>{ACCESS_LABEL[p.access]}</span></>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Access & use: how to get the data, on what terms, and every way to reach it. */
export function AccessSection({ d, labels }: { d: RecordDetail; labels: LabelBook }) {
  const r = d.record
  const contact = pointOfContact(r)
  const spdx = spdxOf(r)
  const points = r.data ?? []
  const primary = primaryAccess(r)
  const primaryUrl = primary && urlOf(primary)
  const ee = points.find((p) => p.service?.type === 'gee' && !urlOf(p))
  const others = points.filter((p) => p !== ee && p !== primary)
  const licUrl = licenseUrl(r)
  const formats = formatsOf(r)
  const mail = contact?.email && `mailto:${contact.email}?subject=${encodeURIComponent(`MOSAIC ${d.id} — access request`)}`
  return (
    <section id="access" className="dp-sec">
      <h2>Access &amp; use</h2>
      <div className="ds-access">
        {r.access === 'public' ? (
          <p>This dataset is openly available{spdx ? ` under the ${spdx} license` : ''}. MOSAIC connects to the source rather than re-hosting the data.</p>
        ) : r.access === 'restricted' ? (
          <p>Access to this dataset is restricted. To request access, please contact the data steward.</p>
        ) : r.access === 'non-public' ? (
          <p>This dataset is for internal CGIAR use only. Contact the MOSAIC team if you believe you should have access.</p>
        ) : (
          <p>The access level for this dataset has not been specified yet. Contact the data steward or the MOSAIC coordination team for details.</p>
        )}
        {!spdx && r.license_text && <p><strong>Terms of use at the source:</strong> {r.license_text}</p>}
        {r.access_note && <p><strong>How to obtain it:</strong> {r.access_note}</p>}
        {primaryUrl ? (
          <a href={primaryUrl} className="btn btn-primary" target="_blank" rel="noopener noreferrer">{METHOD_ACTION[primary?.access_method ?? 'landing_page'] ?? 'Go to source'} ↗</a>
        ) : r.access !== 'public' && mail ? (
          <a className="btn btn-primary" href={mail}>Request access by email</a>
        ) : (
          <p>No direct source link has been registered yet. See the contact below or the metadata record.</p>
        )}
        {ee && (
          <div className="ds-access-gee">
            <p><strong>Google Earth Engine asset</strong></p>
            {ee.description && <p><code>{ee.description}</code></p>}
            <p className="dp-small">
              An asset identifier, not a download link. The asset is not public yet — opening it in Earth Engine needs an Earth Engine account and access granted by the MOSAIC coordination team.
            </p>
          </div>
        )}
      </div>

      {others.length > 0 && (
        <>
          <h3>{primaryUrl ? 'Other ways to access it' : 'Ways to access it'}</h3>
          <AccessPoints points={others} recordAccess={r.access} labels={labels} />
        </>
      )}

      <dl className="dp-kv">
        <div><dt>Access level</dt><dd>{r.access ? labels.label('access', r.access) : 'Not specified'}</dd></div>
        <div>
          <dt>License</dt>
          <dd>{licUrl ? <a href={licUrl} target="_blank" rel="noopener noreferrer">{licenseText(r) ?? licUrl}</a> : licenseText(r) ?? 'Not specified'}</dd>
        </div>
        {r.attribution && <div><dt>Attribution</dt><dd>{r.attribution}</dd></div>}
        {formats.length > 0 && <div><dt>Formats</dt><dd>{formats.join(', ')}</dd></div>}
        {primaryUrl && <div><dt>Source address</dt><dd><a href={primaryUrl} target="_blank" rel="noopener noreferrer">{primaryUrl}</a></dd></div>}
        <div>
          <dt>Contact</dt>
          <dd>{contact ? (contact.email ? <a href={`mailto:${contact.email}`}>{contactLine(contact) || contact.email}</a> : contactLine(contact)) : 'Via the MOSAIC coordination team'}</dd>
        </div>
      </dl>
    </section>
  )
}
