import { describe, expect, it } from 'vitest'
import { LabelBook } from '../src/lib/domain/labels'
import { dataTypeIcon, datasetHref, periodText } from '../src/lib/domain/present'
import { emptyQuery, fromSearchParams, toSearchParams, toggleFilter } from '../src/lib/domain/query'
import { search } from '../src/lib/domain/search'
import { fold, key } from '../src/lib/domain/text'
import { summary } from './fixtures'

describe('fold / key — same cases as mosaic-api tests/test_domain.py', () => {
  it('handles case, accents, symbols and other scripts', () => {
    expect(fold('Côte d’Ivoire – 2021')).toBe('cote d ivoire 2021')
    expect(fold('STRAßE Ørsted Æble')).toBe('strasse orsted aeble')
    expect(fold('ລາວ Lao')).toBe('ລາວ lao')
    expect(fold('हिंदी नक्शा')).toBe('हद नकश')
    expect(fold('Ｆｕｌｌ ﬁle')).toBe('full file')
    expect(key('CC BY 4.0')).toBe('cc-by-4-0')
    expect(key('cc-by-4.0')).toBe('cc-by-4-0')
    expect(key('Land cover / land use')).toBe('land-cover-land-use')
  })
})

describe('URL state', () => {
  it('round-trips and keeps one parameter per value', () => {
    const q = { ...emptyQuery(), text: 'forest', filters: { license: ['Source terms, see site'], geography: ['PER'] }, page: 2 }
    const back = fromSearchParams(toSearchParams(q))
    expect(back.filters).toEqual({ geography: ['PER'], license: ['Source terms, see site'] })
    expect(back).toMatchObject({ text: 'forest', sort: 'recent', page: 2 })
    expect(fromSearchParams(new URLSearchParams('q=forest')).sort).toBe('relevance')
  })
  it('reads links of the previous website', () => {
    const q = fromSearchParams(new URLSearchParams('country=Peru&living_landscape=PER-PCL&access_level=Open&landscape=GLB'))
    expect(q.filters).toEqual({ geography: ['Peru'], landscape: ['PER-PCL', 'not_specified'], access: ['public'] })
  })
  it('toggling a filter goes back to page 1', () => {
    const q = toggleFilter({ ...emptyQuery(), page: 4 }, 'theme', 'climate')
    expect(q).toMatchObject({ page: 1, filters: { theme: ['climate'] } })
    expect(toggleFilter(q, 'theme', 'climate').filters.theme).toEqual([])
  })
})

describe('search (static API)', () => {
  const items = [
    summary('mosaic:A', { title: 'Deforestación anual Ucayali', facets: { source: ['mosaic'], geography: ['PER'], access: ['public'] }, period: [2001, 2024] }),
    summary('cdh:B', { title: 'Annual rainfall', facets: { source: ['cdh'], geography: ['global'], access: ['public'] }, period: [1981, null] }),
    summary('mosaic:C', { title: 'Conflicts', facets: { source: ['mosaic'], geography: ['KEN'], access: ['restricted'] }, period: [2026, 2026] }),
  ]
  const texts = Object.fromEntries(items.map((i) => [i.id, fold(i.title)]))
  const run = (over: Partial<ReturnType<typeof emptyQuery>>) => search(items, texts, { ...emptyQuery(), ...over })

  it('words are accent-insensitive and all must match', () => {
    expect(run({ text: 'DEFORESTACION' }).items.map((i) => i.id)).toEqual(['mosaic:A'])
    expect(run({ text: 'anual UCAYALI' }).total).toBe(1)
    expect(run({ text: 'annual nothing' }).total).toBe(0)
  })
  it('OR inside a filter, AND across filters, any case', () => {
    expect(run({ filters: { geography: ['per', 'KEN'] } }).total).toBe(2)
    expect(run({ filters: { source: ['MOSAIC'], access: ['Restricted'] } }).items.map((i) => i.id)).toEqual(['mosaic:C'])
  })
  it('sorts and counts facets over all hits', () => {
    expect(run({ sort: 'za' }).items.map((i) => i.title)).toEqual(['Deforestación anual Ucayali', 'Conflicts', 'Annual rainfall'])
    expect(run({ sort: 'oldest' }).items[0].id).toBe('cdh:B')
    const r = run({ filters: { source: ['mosaic'] }, pageSize: 1 })
    expect(r.items).toHaveLength(1)
    expect(r.facets.geography).toEqual({ PER: 1, KEN: 1 })
  })
})

describe('labels', () => {
  const book = new LabelBook({ geography: { PER: 'Peru' }, theme: { 'pressures-drivers': 'Pressures / drivers' } }, { license: { 'CC-BY-4.0': 3 } })
  it('resolves labels and codes to canonical values, and warns about unknown ones', () => {
    expect(book.resolve({ geography: ['Perú'], theme: ['Pressures / drivers'], license: ['cc by 4.0'] }).filters).toEqual({
      geography: ['PER'], theme: ['pressures-drivers'], license: ['CC-BY-4.0'],
    })
    expect(book.resolve({ theme: ['astrology'] }).warnings).toEqual(["theme='astrology' matches no value of this filter"])
    expect(book.label('theme', 'not_specified')).toBe('Not specified')
  })
})

describe('presentation helpers', () => {
  it('maps data kinds to the approved icons and formats periods', () => {
    expect(dataTypeIcon(['raster'])).toBe('Raster')
    expect(dataTypeIcon(['raster', 'vector'])).toBe('Mixed')
    expect(dataTypeIcon(['not_specified'])).toBeNull()
    expect(periodText([2001, 2024])).toBe('2001–2024')
    expect(periodText([1981, null])).toBe('1981 onwards')
    expect(datasetHref('/website', 'mosaic:MFL-2026-079')).toBe('/website/catalogue/dataset/?id=mosaic:MFL-2026-079')
  })
})
