import type { CSSProperties } from 'react'
import type { AccessPoint, Contact, MosaicRecord, RecordDetail, RecordSummary } from '../../lib/api/types'
import { catalogue } from '../../lib/catalog'
import type { LabelBook } from '../../lib/domain/labels'
import {
  ACCESS_BADGE,
  ACCESS_LABEL,
  COMPLETENESS_BADGE,
  COMPLETENESS_LABEL,
  datasetHref,
  joinLabels,
  periodText,
} from '../../lib/domain/present'
import { useAsync } from '../../lib/ui/useAsync'
import { QS_STORAGE_KEY } from '../../lib/ui/useCatalogueQuery'
import { LoadError, Loading } from '../catalogue/LoadState'

/*
 * Dataset page. Same sections, order, classes and inline styles as the approved page
 * (catalogue/[id].astro of the previous website); the content now comes from the API and shows the
 * MOSAIC metadata (themes, geography, access points, completeness, provenance).
 */

const S: Record<string, CSSProperties> = {
  page: { paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)', maxWidth: 860 },
  badges: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' },
  badgeNote: { fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', alignSelf: 'center' },
  title: { marginBottom: 'var(--space-6)' },
  lead: { fontSize: 'var(--text-lg)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-6)', maxWidth: 680 },
  section: { marginBottom: 'var(--space-8)' },
  h2: { fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' },
  h2tight: { fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' },
  access: { marginBottom: 'var(--space-8)', padding: 'var(--space-6)', backgroundColor: 'var(--color-tint)', borderRadius: 'var(--radius-lg)' },
  p4: { marginBottom: 'var(--space-4)' },
  sub: { marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--mosaic-teal)' },
  small: { fontSize: 'var(--text-sm)', marginBottom: 0 },
  code: { fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', wordBreak: 'break-all' },
  citation: { marginBottom: 'var(--space-8)', padding: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)', borderLeft: '4px solid var(--mosaic-teal)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' },
  citationText: { fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--color-gray-600)', lineHeight: 1.7 },
  legend: { marginBottom: 'var(--space-8)', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' },
  legendSummary: { cursor: 'pointer', fontWeight: 600, color: 'var(--color-link)' },
  relatedList: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-3)' },
  relatedItem: { display: 'flex', flexDirection: 'column', gap: 2, padding: 'var(--space-4)', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit' },
  relatedTitle: { fontWeight: 600, color: 'var(--color-gray-900)' },
  relatedMeta: { fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' },
  back: { color: 'var(--color-link)', fontSize: 'var(--text-sm)' },
  link: { color: 'var(--color-link)', fontWeight: 600 },
}

const METHOD_ACTION: Record<string, string> = {
  download: 'Download',
  landing_page: 'Go to source',
  service: 'Open service',
  request: 'Request access',
}

function contactLine(c: Contact): string {
  const who = [c.name, c.organization].filter(Boolean).join(', ')
  return who || c.email || ''
}

function pointOfContact(r: MosaicRecord): Contact | undefined {
  const cs = r.contact ?? []
  return cs.find((c) => c.roles?.includes('point-of-contact')) ?? cs.find((c) => c.email)
}

function producers(r: MosaicRecord): string | null {
  const names = (r.contact ?? []).filter((c) => c.roles?.includes('producer')).map((c) => c.organization ?? c.name)
  return names.filter(Boolean).join(', ') || null
}

/** SPDX licence; for LicenseRef-… (no SPDX code) the source's own terms. */
function licenseText(r: MosaicRecord): string | null {
  if (r.license && !r.license.startsWith('LicenseRef-')) return r.license
  return r.license_text ?? (r.license ? 'Terms of the source' : null)
}

const licenseUrl = (r: MosaicRecord): string | undefined => r.additional_links?.find((l) => l.rel === 'license')?.url

/** First location of a data entry (v0.2: data[].locations[].url). */
const urlOf = (p: AccessPoint): string | undefined => p.locations?.[0]?.url

const authorName = (a: NonNullable<NonNullable<MosaicRecord['citation']>['authors']>[number]): string =>
  'organization' in a ? a.organization : [a.family, a.given].filter(Boolean).join(', ')

const yearsOf = (r: MosaicRecord): [number | null, number | null] => {
  const t = r.temporal
  return [toYear(t?.start_date ?? t?.date), toYear(t?.end_date ?? t?.date)]
}

function citationText(d: RecordDetail, base: string): string {
  const c = d.record.citation
  if (c) {
    if (c.text) return c.text
    const authors = (c.authors ?? []).map(authorName).join('; ')
    const parts = [authors, c.date && `(${c.date})`, c.title, c.publisher, d.record.doi && `https://doi.org/${d.record.doi}`]
    const text = parts.filter(Boolean).join('. ')
    if (text) return text
  }
  const year = yearsOf(d.record)[1] ?? new Date().getFullYear()
  return `${producers(d.record) ?? 'CGIAR'} (${year}). ${d.record.title ?? d.local_id}. MOSAIC — CGIAR MFL Science Programme. Retrieved from ${location.origin}${datasetHref(base, d.id)}`
}

const toYear = (v: string | null | undefined) => (v ? Number(String(v).slice(0, 4)) : null)

function Facts({ d }: { d: RecordDetail }) {
  const r = d.record
  const contact = pointOfContact(r)
  const access = r.data?.find((p) => urlOf(p) && (p.access ?? r.access) === 'public') ?? r.data?.find((p) => urlOf(p))
  const fact = (label: string, value: React.ReactNode) => (
    <div className="ds-fact">
      <span className="ds-fact-label">{label}</span>
      <span className="ds-fact-value">{value}</span>
    </div>
  )
  return (
    <section className="ds-facts" aria-label="Dataset at a glance">
      {fact('Source organization', producers(r) ?? 'Not specified')}
      {fact('Time period', periodText(yearsOf(r)) ?? r.temporal?.text ?? 'Not specified')}
      {fact('License', licenseText(r) ?? 'Not specified')}
      {fact('Access level', r.access ? ACCESS_LABEL[r.access] : 'Not specified')}
      {fact('Metadata', COMPLETENESS_LABEL[d.quality.status] ?? d.quality.status)}
      {fact('Contact', contact?.email ? <a href={`mailto:${contact.email}`}>{contactLine(contact) || contact.email}</a> : contact ? contactLine(contact) : 'Via the MOSAIC team')}
      {access && urlOf(access) && fact('Source link', <a href={urlOf(access)} target="_blank" rel="noopener noreferrer">Go to source ↗</a>)}
      {fact('Catalogue', d.provenance.source_name)}
    </section>
  )
}

function OverviewTable({ d, labels, base }: { d: RecordDetail; labels: LabelBook; base: string }) {
  const r = d.record
  const row = (label: string, value: React.ReactNode) => (
    <tr>
      <td><strong>{label}</strong></td>
      <td>{value}</td>
    </tr>
  )
  const keywords = (r.keywords ?? []).map((k) => (typeof k === 'string' ? k : k.term))
  const freq = r.temporal?.update_frequency
  const licUrl = licenseUrl(r)
  // each landscape links to its profile page (catalogue -> landscape profile)
  const landscapes = d.landscapes.map((c, i) => (
    <span key={c}>
      {i > 0 && ', '}
      <a href={`${base}/landscapes/${c.toLowerCase()}/`}>{labels.label('landscape', c)}</a> ({c})
    </span>
  ))
  return (
    <section style={S.section}>
      <h2 style={S.h2}>Dataset overview</h2>
      <table className="data-table">
        <tbody>
          {row('Dataset ID', <code>{d.id}</code>)}
          {row('Country', joinLabels(labels, 'geography', r.spatial?.geography ?? [], 20) ?? 'Not specified')}
          {row('Living Landscape', landscapes.length ? <>{landscapes}{d.landscapes_derived ? ' — from the dataset extent' : ''}</> : 'Not specified')}
          {row('Theme', joinLabels(labels, 'theme', r.themes ?? [], 20) ?? 'Not specified')}
          {row('Data Type', joinLabels(labels, 'data_kind', d.facets.data_kind ?? []) ?? 'Not specified')}
          {(d.facets.geometry ?? []).some((g) => g !== 'not_specified') && row('Geometry', joinLabels(labels, 'geometry', d.facets.geometry ?? []))}
          {r.spatial?.resolution && row('Spatial Resolution', r.spatial.resolution.text ?? `${r.spatial.resolution.value} ${r.spatial.resolution.unit}`)}
          {r.temporal?.text && row('Temporal Coverage', r.temporal.text)}
          {freq && freq !== 'unknown' && row('Update Frequency', freq[0].toUpperCase() + freq.slice(1))}
          {keywords.length > 0 && row('Keywords', keywords.join(', '))}
          {r.doi && row('DOI', <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer">{r.doi}</a>)}
          {row('Access Level', r.access ? ACCESS_LABEL[r.access] : 'Not specified')}
          {row('License', licUrl ? <a href={licUrl} target="_blank" rel="noopener noreferrer">{licenseText(r) ?? licUrl}</a> : licenseText(r) ?? 'Not specified')}
          {(r.funding ?? []).length > 0 && row('Funding', (r.funding ?? []).map((f) => f.name).join(', '))}
          {row('Metadata', `${COMPLETENESS_LABEL[d.quality.status] ?? d.quality.status} (${Math.round((d.quality.completeness.minimum ?? 0) * 100)}% of the MOSAIC minimum)`)}
        </tbody>
      </table>
    </section>
  )
}

function AccessPoints({ points, recordAccess }: { points: AccessPoint[]; recordAccess?: string }) {
  if (points.length === 0) return null
  return (
    <table className="data-table" style={{ marginBottom: 'var(--space-4)' }}>
      <tbody>
        {points.map((p, i) => (
          <tr key={i}>
            <td>
              <strong>{p.name}</strong>
              {p.description && <><br /><span style={{ fontSize: 'var(--text-sm)' }}>{p.description}</span></>}
              {p.file_size && <><br /><span style={{ fontSize: 'var(--text-xs)' }}>{p.file_size}</span></>}
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

function AccessPanel({ d }: { d: RecordDetail }) {
  const r = d.record
  const contact = pointOfContact(r)
  const spdx = r.license && !r.license.startsWith('LicenseRef-') ? r.license : undefined
  const points = r.data ?? []
  const contactP = contact && (
    <p style={{ marginTop: 'var(--space-3)' }}>
      <strong>Contact:</strong>{' '}
      {contact.email ? <a href={`mailto:${contact.email}`}>{contactLine(contact) || contact.email}</a> : contactLine(contact)}
    </p>
  )
  const ee = points.find((p) => p.service?.type === 'gee' && !urlOf(p))
  // The approved page has one "Go to source" button: the first public point with a URL.
  const primary = points.find((p) => urlOf(p) && (p.access ?? r.access) === 'public')
  const primaryUrl = primary && urlOf(primary)
  const others = points.filter((p) => p !== ee && p !== primary)
  return (
    <section style={S.access}>
      <h2 style={S.h2tight}>How to access this dataset</h2>
      {r.access === 'public' ? (
        <div>
          <p style={S.p4}>
            This dataset is openly available{spdx ? ` under the ${spdx} license` : ''}. MOSAIC connects to the source rather than re-hosting the data.
          </p>
          {!spdx && r.license_text && <p style={S.p4}><strong>Terms of use at the source:</strong> {r.license_text}</p>}
        </div>
      ) : r.access === 'restricted' ? (
        <p style={S.p4}>Access to this dataset is restricted. To request access, please contact the data steward.</p>
      ) : r.access === 'non-public' ? (
        <p style={S.p4}>This dataset is for internal CGIAR use only. Contact the MOSAIC team if you believe you should have access.</p>
      ) : (
        <p style={S.p4}>The access level for this dataset has not been specified yet. Contact the data steward or the MOSAIC coordination team for details.</p>
      )}
      {r.access_note && <p style={S.p4}><strong>How to obtain it:</strong> {r.access_note}</p>}
      {primaryUrl && (
        <a href={primaryUrl} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
          {METHOD_ACTION[primary?.access_method ?? 'landing_page'] ?? 'Go to source'}
        </a>
      )}
      {!primaryUrl && r.access === 'public' && (
        <p style={{ marginBottom: 'var(--space-2)' }}>No direct source link has been registered yet. See the contact below or the metadata record above.</p>
      )}
      {others.length > 0 && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <p style={{ marginBottom: 'var(--space-2)' }}><strong>{primaryUrl ? 'Other ways to access it' : 'Ways to access it'}</strong></p>
          <AccessPoints points={others} recordAccess={r.access} />
        </div>
      )}
      {contactP ?? (r.access !== 'public' && <p>No steward contact is registered yet. Contact the MOSAIC coordination team.</p>)}
      {ee && (
        <div style={S.sub}>
          <p style={{ marginBottom: 'var(--space-2)' }}><strong>Google Earth Engine asset</strong></p>
          {ee.description && <p style={{ marginBottom: 'var(--space-2)' }}><code style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>{ee.description}</code></p>}
          <p style={S.small}>
            An asset identifier, not a download link. The asset is not public yet — opening it in Earth Engine needs an Earth Engine account and access granted by the MOSAIC coordination team.
          </p>
        </div>
      )}
    </section>
  )
}

function MetadataRecord({ d, json }: { d: RecordDetail; json: string }) {
  return (
    <section style={S.section}>
      <h2 style={S.h2tight}>Full metadata record</h2>
      <p>
        This record comes from <strong>{d.provenance.source_name}</strong>
        {d.provenance.record_url && (
          <>
            {' '}— <a href={d.provenance.record_url} target="_blank" rel="noopener noreferrer" style={S.link}>view it in its catalogue ↗</a>
          </>
        )}
        .
        <br />
        <a href={json} target="_blank" rel="noopener noreferrer" style={S.link}>MOSAIC record (JSON)</a>
      </p>
      {d.same_as.length > 0 && <p style={{ color: 'var(--color-gray-600)' }}>Also described in: {d.same_as.join(', ')}.</p>}
    </section>
  )
}

function Completeness({ d }: { d: RecordDetail }) {
  const missing = d.quality.missing_minimum
  return (
    <section style={S.section}>
      <h2 style={S.h2tight}>About the metadata</h2>
      {missing.length === 0 ? (
        <p><strong>Complete:</strong> the record has every field of the MOSAIC minimum, enough to find, understand, cite and reach the data without opening it.</p>
      ) : (
        <p>
          <strong>Incomplete:</strong> the record does not have these fields of the MOSAIC minimum yet: {missing.join(', ')}. MOSAIC does not invent them; the data owner completes them.
        </p>
      )}
    </section>
  )
}

/** Same markup as components/ui/Breadcrumb.astro (its styles are global). */
function Breadcrumb({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol className="breadcrumb-list">
        {crumbs.map((c, i) => (
          <li key={i} className="breadcrumb-item">
            {c.href && i < crumbs.length - 1 ? (
              <a href={c.href} className="breadcrumb-link">{c.label}</a>
            ) : (
              <span aria-current="page" className="breadcrumb-current">{c.label}</span>
            )}
            {i < crumbs.length - 1 && (
              <svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 12 12" fill="none" className="breadcrumb-sep">
                <path d="M4.5 2.5 7.5 6l-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Related({ items, base, labels }: { items: RecordSummary[]; base: string; labels: LabelBook }) {
  if (items.length === 0) return null
  return (
    <section style={S.section}>
      <h2 style={S.h2}>Related datasets</h2>
      <ul style={S.relatedList}>
        {items.map((r) => (
          <li key={r.id}>
            <a href={datasetHref(base, r.id)} style={S.relatedItem}>
              <span style={S.relatedTitle}>{r.title}</span>
              <span style={S.relatedMeta}>
                {[joinLabels(labels, 'landscape', r.landscapes, 2), joinLabels(labels, 'theme', r.themes, 1)].filter(Boolean).join(' · ')}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface Props {
  base: string
}

export function DatasetDetail({ base }: Props) {
  const id = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('id') ?? ''
  const repo = catalogue()
  const state = useAsync(async () => {
    const [detail, overview] = await Promise.all([repo.get(id), repo.overview()])
    const related = detail ? await repo.related(detail, 4) : []
    return { detail, labels: overview.labels, related }
  }, [repo, id])

  if (state.status === 'loading') return <div className="container" style={S.page}><Loading what="the dataset" /></div>
  if (state.status === 'error') return <div className="container" style={S.page}><LoadError error={state.error} onRetry={state.retry} /></div>
  const { detail: d, labels, related } = state.data
  if (!d) {
    return (
      <div className="container" style={S.page}>
        <div className="empty-state">
          <h3>Dataset not found</h3>
          <p>No dataset has the id “{id}”.</p>
          <a className="empty-state-clear" href={`${base}/catalogue`}>Back to catalogue</a>
        </div>
      </div>
    )
  }
  if (typeof document !== 'undefined') document.title = `${d.record.title ?? d.local_id} | MOSAIC`
  let back = `${base}/catalogue`
  try {
    const qs = sessionStorage.getItem(QS_STORAGE_KEY)
    if (qs) back = `${base}/catalogue?${qs}`
  } catch {
    /* storage unavailable */
  }
  const r = d.record
  const title = r.title ?? d.local_id
  const lic = licenseText(r)

  return (
    <div className="container" style={S.page}>
      <Breadcrumb crumbs={[{ label: 'Home', href: `${base}/` }, { label: 'Catalogue', href: `${base}/catalogue` }, { label: title }]} />

      <div style={S.badges}>
        <span className={COMPLETENESS_BADGE[d.quality.status] ?? 'badge badge-raw'}>{COMPLETENESS_LABEL[d.quality.status]}</span>
        <span className={r.access ? ACCESS_BADGE[r.access] : 'badge badge-internal'}>{r.access ? ACCESS_LABEL[r.access] : 'Access not specified'}</span>
        {lic && <span style={S.badgeNote}>{lic}</span>}
      </div>

      <h1 style={S.title}>{title}</h1>
      {r.description && <p style={S.lead}>{r.description}</p>}
      {r.note && <p style={{ ...S.lead, fontSize: 'var(--text-base)' }}>{r.note}</p>}

      <Facts d={d} />
      <OverviewTable d={d} labels={labels} base={base} />
      <MetadataRecord d={d} json={repo.recordLink(d)} />
      <AccessPanel d={d} />
      <Completeness d={d} />

      <section style={S.citation}>
        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>Suggested citation</h2>
        <p style={S.citationText}>{citationText(d, base)}</p>
      </section>

      <details style={S.legend}>
        <summary style={S.legendSummary}>Metadata completeness legend</summary>
        <table className="data-table" style={{ marginTop: 'var(--space-4)' }}>
          <thead>
            <tr><th>Status</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><span className="badge badge-validated">Complete</span></td><td>Every field of the MOSAIC minimum is filled: title, description, type, themes, licence, contacts with their organization (one of them grants the licence), access (and how to obtain it when not public) and at least one data entry (with its link when public).</td></tr>
            <tr><td><span className="badge badge-raw">Incomplete</span></td><td>Some of those fields are missing. The record is still listed; the missing fields are named above.</td></tr>
          </tbody>
        </table>
      </details>

      <Related items={related} base={base} labels={labels} />

      <a href={back} style={S.back}>&larr; Back to catalogue</a>
    </div>
  )
}
