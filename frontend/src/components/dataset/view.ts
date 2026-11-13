/**
 * Pure helpers of the dataset page: they turn a MOSAIC record (standard v0.2, from mosaic-api) into
 * the words and links the page shows. No fetch, no DOM, no React - tested in tests/dataset-view.test.ts.
 */
import type { AccessPoint, Contact, MosaicRecord, RecordDetail } from '../../lib/api/types'
import { datasetHref, periodText } from '../../lib/domain/present'
import type { LabelBook } from '../../lib/domain/labels'

/** Where corrections to a MOSAIC record go (the catalogue's issue tracker). */
export const CATALOG_ISSUES = 'https://github.com/MOSAIC-mfl/catalog/issues/new'

export const METHOD_ACTION: Record<string, string> = {
  download: 'Download',
  landing_page: 'Go to source',
  service: 'Open service',
  request: 'Request access',
}

export const ROLE_LABEL: Record<string, string> = {
  'point-of-contact': 'Point of contact',
  producer: 'Producer',
  'rights-holder': 'Rights holder',
  publisher: 'Publisher',
  distributor: 'Distributor',
  custodian: 'Custodian',
  funder: 'Funder',
  author: 'Author',
}

export const urlOf = (p: AccessPoint): string | undefined => p.locations?.[0]?.url

export function contactLine(c: Contact): string {
  const who = [c.name, c.organization].filter(Boolean).join(', ')
  return who || c.email || ''
}

export function pointOfContact(r: MosaicRecord): Contact | undefined {
  const cs = r.contact ?? []
  return cs.find((c) => c.roles?.includes('point-of-contact')) ?? cs.find((c) => c.email)
}

export function producers(r: MosaicRecord): string | null {
  const names = (r.contact ?? []).filter((c) => c.roles?.includes('producer')).map((c) => c.organization ?? c.name)
  return names.filter(Boolean).join(', ') || null
}

/** SPDX id when there is one; otherwise the source's own terms. */
export const spdxOf = (r: MosaicRecord): string | null => (r.license && !r.license.startsWith('LicenseRef-') ? r.license : null)

export function licenseText(r: MosaicRecord): string | null {
  return spdxOf(r) ?? r.license_text ?? (r.license ? 'Terms at the source' : null)
}

/** Short form for the header: the SPDX id, or "Terms at the source". */
export function licenseShort(r: MosaicRecord): string {
  return spdxOf(r) ?? (r.license || r.license_text ? 'Terms at the source' : 'Not specified')
}

export const licenseUrl = (r: MosaicRecord): string | undefined => r.additional_links?.find((l) => l.rel === 'license')?.url

const toYear = (v: string | null | undefined) => (v ? Number(String(v).slice(0, 4)) || null : null)

export function yearsOf(r: MosaicRecord): [number | null, number | null] {
  const t = r.temporal
  return [toYear(t?.start_date ?? t?.date), toYear(t?.end_date ?? t?.date)]
}

export function periodOf(r: MosaicRecord): string | null {
  return periodText(yearsOf(r)) ?? r.temporal?.text ?? null
}

export function resolutionOf(r: MosaicRecord): string | null {
  const res = r.spatial?.resolution
  if (!res) return null
  if (res.value !== undefined && res.value !== null) return res.unit ? `${res.value} ${res.unit}` : String(res.value)
  return res.text ?? null
}

/** Where the data is: its living landscapes, or else its countries / regions. */
export function coverageOf(d: RecordDetail, labels: LabelBook): string | null {
  const geo = d.record.spatial?.geography ?? []
  if (geo.includes('global')) return 'Global'
  if (d.landscapes.length) return d.landscapes.map((c) => labels.label('landscape', c)).join(', ')
  return geo.map((g) => labels.label('geography', g)).join(', ') || null
}

/** The record's main public link, then any link. */
export function primaryAccess(r: MosaicRecord): AccessPoint | undefined {
  const pts = r.data ?? []
  return pts.find((p) => urlOf(p) && (p.access ?? r.access) === 'public' && p.access_method !== 'request') ?? pts.find((p) => urlOf(p) && p.access_method !== 'request')
}

/** Names people know for the media types of data entries (anything else is shown as it is). */
const FORMAT_NAME: [RegExp, string][] = [
  [/^image\/tiff;.*profile=cloud-optimized/i, 'Cloud Optimized GeoTIFF'],
  [/^image\/tiff/i, 'GeoTIFF'],
  [/^application\/x-esri-shapefile|^application\/vnd\.shp/i, 'Shapefile'],
  [/^text\/csv/i, 'CSV'],
  [/spreadsheetml|^application\/vnd\.ms-excel/i, 'XLSX'],
  [/^application\/x-netcdf|^application\/netcdf/i, 'NetCDF'],
  [/^application\/geo\+json/i, 'GeoJSON'],
  [/^application\/geopackage/i, 'GeoPackage'],
  [/^application\/vnd\.apache\.parquet/i, 'Parquet'],
  [/^application\/zip/i, 'ZIP'],
  [/^application\/json/i, 'JSON'],
  [/^application\/pdf/i, 'PDF'],
]

export const formatName = (mediaType: string): string => FORMAT_NAME.find(([re]) => re.test(mediaType))?.[1] ?? mediaType

/** Formats of the data entries, by name, without repeats. */
export function formatsOf(r: MosaicRecord): string[] {
  return [...new Set((r.data ?? []).map((p) => p.media_type).filter((m): m is string => !!m).map(formatName))]
}

const authorName = (a: NonNullable<NonNullable<MosaicRecord['citation']>['authors']>[number]): string =>
  'organization' in a ? a.organization : [a.family, a.given].filter(Boolean).join(', ')

/** The record's own citation, when it has one (never made up). */
export function statedCitation(r: MosaicRecord): string | null {
  const c = r.citation
  if (!c) return null
  if (c.text) return c.text
  const authors = (c.authors ?? []).map(authorName).join('; ')
  const parts = [authors, c.date && `(${c.date})`, c.title, c.publisher, r.doi && `https://doi.org/${r.doi}`]
  return parts.filter(Boolean).join('. ') || null
}

/** A reference to the catalogue record itself, for data without a citation of its own. */
export function recordReference(d: RecordDetail, base: string, origin: string): string {
  return `${d.record.title ?? d.local_id}. MOSAIC record ${d.id}. ${origin}${datasetHref(base, d.id)} (accessed [date]).`
}

/** "Suggest an edit" / "Report a problem": the catalogue's tracker for MOSAIC, the record at its source otherwise. */
export function correctionLinks(d: RecordDetail): { edit: string; problem: string; atSource: boolean } | null {
  if (d.source === 'mosaic') {
    const t = (what: string) => `${CATALOG_ISSUES}?title=${encodeURIComponent(`${d.local_id}: ${what}`)}`
    return { edit: t('suggested edit'), problem: t('problem with this record'), atSource: false }
  }
  const url = d.provenance.record_url
  return url ? { edit: url, problem: url, atSource: true } : null
}
