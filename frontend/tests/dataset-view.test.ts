import { describe, expect, it } from 'vitest'
import type { RecordDetail } from '../src/lib/api/types'
import { LabelBook } from '../src/lib/domain/labels'
import { readinessBadge, readinessLabel, readinessRank } from '../src/lib/domain/readiness'
import { sortOptions } from '../src/components/catalogue/FilterGroup'
import { correctionLinks, coverageOf, licenseShort, primaryAccess, resolutionOf, statedCitation } from '../src/components/dataset/view'

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
    quality: { status: 'incomplete', completeness: {}, missing_minimum: [] },
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
    expect(correctionLinks(d)?.edit).toContain('github.com/MOSAIC-mfl/catalog/issues/new')
    const cdh = detail({ source: 'cdh', provenance: { source: 'cdh', source_name: 'CGIAR Climate Data Hub', record_url: 'https://github.com/x/y', format: 'cdh', fetched_at: '' } } as never)
    expect(correctionLinks(cdh)).toEqual({ edit: 'https://github.com/x/y', problem: 'https://github.com/x/y', atSource: true })
  })
})
