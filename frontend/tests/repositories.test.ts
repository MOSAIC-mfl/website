import { describe, expect, it } from 'vitest'
import { readConfig } from '../src/lib/config'
import { ApiError, type JsonFetcher } from '../src/lib/catalog/http'
import { StaticCatalogRepository } from '../src/lib/catalog/static-repository'
import { emptyQuery } from '../src/lib/domain/query'
import { summary } from './fixtures'

const BASE = 'https://api.example'
const files: Record<string, unknown> = {
  [`${BASE}/v1/sources.json`]: [{ id: 'mosaic', name: 'MOSAIC' }, { id: 'cdh', name: 'CGIAR Climate Data Hub' }],
  [`${BASE}/v1/_index/index.json`]: {
    harvested_at: null,
    summaries: [{ path: 'v1/_index/summaries/aaa.json', sha256: 'a', records: 2 }],
    search: { path: 'v1/_index/search/bbb.json', sha256: 'b', records: 2 },
  },
  [`${BASE}/v1/_index/summaries/aaa.json`]: [
    summary('mosaic:MFL-2026-079', { title: 'Forest loss', landscapes: ['PER-PCL'], facets: { geography: ['PER'] } }),
    summary('cdh:esa-worldcover-2021', { title: 'WorldCover', facets: { geography: ['global'] } }),
  ],
  [`${BASE}/v1/_index/search/bbb.json`]: { 'mosaic:MFL-2026-079': 'forest loss', 'cdh:esa-worldcover-2021': 'worldcover land cover' },
  [`${BASE}/v1/records/mosaic/MFL-2026-079.json`]: { id: 'mosaic:MFL-2026-079', record: { title: 'Forest loss' } },
}

function fakeFetcher(log: string[]): JsonFetcher {
  return async <T,>(url: string): Promise<T> => {
    log.push(url)
    if (!(url in files)) throw new ApiError('404 Not Found', 404, url)
    return files[url] as T
  }
}

describe('StaticCatalogRepository', () => {
  it('loads sources and the hashed index files once, then searches in the browser', async () => {
    const log: string[] = []
    const repo = new StaticCatalogRepository(BASE, fakeFetcher(log))
    const res = await repo.search({ ...emptyQuery(), filters: { geography: ['Perú'] } })
    expect(res.items.map((i) => i.id)).toEqual(['mosaic:MFL-2026-079'])
    expect(res.warnings).toEqual([])
    await repo.search({ ...emptyQuery(), text: 'land cover' })
    expect(log.filter((u) => u.endsWith('sources.json'))).toHaveLength(1)
    expect(log.some((u) => u.includes('filters'))).toBe(false) // no filters endpoint (mosaic-api ADR-0007)
    expect(log.filter((u) => u.endsWith('index.json'))).toHaveLength(1)
  })

  it('gets a record by id, case-insensitively, and null when unknown', async () => {
    const repo = new StaticCatalogRepository(BASE, fakeFetcher([]))
    expect((await repo.get('MOSAIC:mfl-2026-079'))?.id).toBe('mosaic:MFL-2026-079')
    expect(await repo.get('mosaic:NOPE')).toBeNull()
  })

  it('retries after a network error', async () => {
    let fail = true
    const flaky: JsonFetcher = async <T,>(url: string) => {
      if (fail) {
        fail = false
        throw new ApiError('offline', null, url)
      }
      return files[url] as T
    }
    const repo = new StaticCatalogRepository(BASE, flaky)
    await expect(repo.overview()).rejects.toThrow('offline')
    const o = await repo.overview()
    expect(o.total).toBe(2)
    expect(o.facets.geography).toEqual({ PER: 1, global: 1 }) // counted in the browser
    expect(o.labels.label('geography', 'PER')).toBe('Peru') // the website's own labels
    expect(o.labels.label('source', 'cdh')).toBe('CGIAR Climate Data Hub')
  })
})

describe('config', () => {
  it('defaults to the static API and validates the mode', () => {
    expect(readConfig({})).toEqual({ apiMode: 'static', apiUrl: 'https://mosaic-mfl.github.io/mosaic-api', profileData: null })
    expect(readConfig({ PUBLIC_MOSAIC_API_MODE: 'LIVE', PUBLIC_MOSAIC_API_URL: 'http://127.0.0.1:8000/' })).toEqual({
      apiMode: 'live', apiUrl: 'http://127.0.0.1:8000', profileData: null,
    })
    expect(() => readConfig({ PUBLIC_MOSAIC_API_MODE: 'graphql' })).toThrow()
  })
})
