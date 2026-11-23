import { describe, expect, it } from 'vitest'
import type { RecordDetail } from '../src/lib/api/types'
import { LabelBook } from '../src/lib/domain/labels'
import { readinessBadge, readinessLabel, readinessRank } from '../src/lib/domain/readiness'
import { sortOptions } from '../src/components/catalogue/FilterGroup'
import { correctionLink, coverageOf, licenseShort, primaryAccess, resolutionOf, samePeriodText, statedCitation } from '../src/components/dataset/view'

const detail = (over: Partial<RecordDetail> & { record?: Partial<RecordDetail['record']> } = {}) =>
  ({
    id: 'mosaic:MFL-2026-001',
    source: 'mosaic',
    local_id: 'MFL-2026-001',
    landscapes: ['IND-CH'],
    landscapes_derived: false,
    facets: {},
    same_as: [],
    provenance: { source: 'mosaic', source_name: 'MOSAIC', record_url: null, format: 'mosaic', fetched_at: '2026-11-12T00:00:00Z' },
    ...over,
    record: { title: 'LULC', spatial: { geography: ['IND'] }, ...(over.record ?? {}) },
  }) as unknown as RecordDetail

const labels = LabelBook.of([{ id: 'mosaic', name: 'MOSAIC' } as never])

describe('readiness', () => {
  it('reads the declared value, and "Not stated" when there is none', () => {
    expect(readinessLabel('validated')).toBe('Validated')
    expect(readinessLabel(undefined)).toBe('Not stated')
    expect(readinessLabel('weird')).toBe('Not stated')
    expect(readinessBadge('raw')).toBe('badge badge-raw')
    expect(labels.label('processing_status', 'not_specified')).toBe('Not stated')
  })
  it('lists the filter options from Raw to Validated, then Not stated', () => {
    expect(sortOptions('processing_status', ['not_specified', 'validated', 'raw', 'processed'], labels)).toEqual([
      'raw', 'processed', 'validated', 'not_specified',
    ])
    expect(readinessRank('validated')).toBeLessThan(readinessRank('not_specified'))
  })
})

describe('dataset page view', () => {
  it('describes coverage, resolution and licence in the words of the page', () => {
    const d = detail({ record: { spatial: { geography: ['IND'], resolution: { value: 30, unit: 'm' } }, license: 'LicenseRef-x', license_text: 'Ask first' } })
    expect(coverageOf(d, labels)).toBe('Central India Highlands')
    expect(resolutionOf(d.record)).toBe('30 m')
    expect(licenseShort(d.record)).toBe('Terms at the source')
    expect(coverageOf(detail({ landscapes: [], record: { spatial: { geography: ['global'] } } }), labels)).toBe('Global')
  })
  it('never makes up a citation', () => {
    expect(statedCitation(detail().record)).toBeNull()
    expect(statedCitation(detail({ record: { citation: { text: 'Doe (2026). LULC.' } } }).record)).toBe('Doe (2026). LULC.')
  })
  it('prefers a public link, and sends corrections where the record lives', () => {
    const d = detail({
      record: {
        access: 'public',
        data: [
          { name: 'ask', access_method: 'request', locations: [{ url: 'mailto:x@y.org' }] },
          { name: 'file', access_method: 'download', locations: [{ url: 'https://example.org/f.tif' }] },
        ],
      },
    } as never)
    expect(primaryAccess(d.record)?.name).toBe('file')
    expect(correctionLink(d)?.url).toContain('github.com/MOSAIC-mfl/catalog/issues/new')
    expect(correctionLink(d)?.url).toContain(encodeURIComponent(': correction'))
    const cdh = detail({ source: 'cdh', provenance: { source: 'cdh', source_name: 'CGIAR Climate Data Hub', record_url: 'https://github.com/x/y', format: 'cdh', fetched_at: '' } } as never)
    expect(correctionLink(cdh)).toEqual({ url: 'https://github.com/x/y', atSource: true })
  })
})

describe('related datasets', () => {
  it('as on the previous website: same landscape and theme first, then catalogue order; bbox-only matches last', async () => {
    const { rankRelated } = await import('../src/lib/catalog/related')
    const { summary } = await import('./fixtures')
    const d = detail({ id: 'mosaic:MFL-2026-025', landscapes: ['ZWE-MB'], facets: { theme: ['ecosystem-services'] } } as never)
    const items = [
      summary('mosaic:MFL-2026-028', { landscapes: ['ZWE-MB'], themes: ['land-cover-land-use'] }),
      summary('cdh:africa-spei-drought', { landscapes: ['ZWE-MB'], landscapes_derived: true, themes: ['climate'] }),
      summary('mosaic:MFL-2026-026', { landscapes: ['ZWE-MB'], themes: ['boundaries-admin-units'] }),
      summary('mosaic:MFL-2026-029', { landscapes: ['ZWE-MB'], themes: ['ecosystem-services'] }),
      summary('mosaic:MFL-2026-027', { landscapes: ['ZWE-MB'], themes: ['land-cover-land-use'] }),
    ]
    expect(rankRelated(d, items, 4).map((r) => r.local_id)).toEqual(['MFL-2026-029', 'MFL-2026-026', 'MFL-2026-027', 'MFL-2026-028'])
  })
})

describe('formats', () => {
  it('names media types the way people know them', async () => {
    const { formatName } = await import('../src/components/dataset/view')
    expect(formatName('image/tiff; application=geotiff; profile=cloud-optimized')).toBe('Cloud Optimized GeoTIFF')
    expect(formatName('application/x-esri-shapefile')).toBe('Shapefile')
    expect(formatName('text/csv')).toBe('CSV')
    expect(formatName('application/x-foo')).toBe('application/x-foo')
  })
})

describe('period as stated', () => {
  it('is the same as the computed period whatever dash it was typed with', () => {
    expect(samePeriodText('2000-2024', '2000–2024')).toBe(true)
    expect(samePeriodText('2000 - 2024', '2000–2024')).toBe(true)
    expect(samePeriodText('2000—2024', '2000–2024')).toBe(true)
  })
  it('is different when the contributor said more than the years', () => {
    expect(samePeriodText('2018 and 2021 campaigns', '2018–2021')).toBe(false)
    expect(samePeriodText('Since 2014, monthly', '2014 onwards')).toBe(false)
    expect(samePeriodText('2023', null)).toBe(false)
  })
})
