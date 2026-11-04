import { describe, expect, it } from 'vitest'
import { readConfig } from '../src/lib/config'
import { ApiError, type JsonFetcher } from '../src/lib/catalog/http'
import { StaticCatalogRepository } from '../src/lib/catalog/static-repository'
import { emptyQuery } from '../src/lib/domain/query'
import { summary } from './fixtures'

const BASE = 'https://api.example'
const files: Record<string, unknown> = {
  [`${BASE}/v1/manifest.json`]: {
    api_version: '0.1.0', standard_version: '0.1.0', harvested_at: null, counts: { resources: 2 }, sources: ['mosaic', 'cdh'],
    files: {
      sources: 'v1/sources.json', facets: 'v1/facets.json', labels: 'v1/labels.json',
      summaries: [{ path: 'v1/summaries/aaa.json', sha256: 'a', records: 2 }],
      search: { path: 'v1/search/bbb.json', sha256: 'b', records: 2 },
      resource: 'v1/resources/{source}/{local_id}.json',
    },
  },
  [`${BASE}/v1/sources.json`]: [],
  [`${BASE}/v1/facets.json`]: { geography: { PER: 1, global: 1 } },
  [`${BASE}/v1/labels.json`]: { labels: { geography: { PER: 'Peru', global: 'Global' } } },
  [`${BASE}/v1/summaries/aaa.json`]: [
    summary('mosaic:MFL-2026-079', { title: 'Forest loss', landscapes: ['PER-PCL'], facets: { geography: ['PER'] } }),
    summary('cdh:esa-worldcover-2021', { title: 'WorldCover', facets: { geography: ['global'] } }),
  ],
  [`${BASE}/v1/search/bbb.json`]: { 'mosaic:MFL-2026-079': 'forest loss', 'cdh:esa-worldcover-2021': 'worldcover land cover' },
  [`${BASE}/v1/resources/mosaic/MFL-2026-079.json`]: { id: 'mosaic:MFL-2026-079', record: { title: 'Forest loss' } },
}

function fakeFetcher(log: string[]): JsonFetcher {
  return async <T,>(url: string): Promise<T> => {
    log.push(url)
    if (!(url in files)) throw new ApiError('404 Not Found', 404, url)
    return files[url] as T
  }
}

describe('StaticCatalogRepository', () => {
  it('loads the manifest and hashed files once, then searches in the browser', async () => {
    const log: string[] = []
    const repo = new StaticCatalogRepository(BASE, fakeFetcher(log))
    const res = await repo.search({ ...emptyQuery(), filters: { geography: ['Perú'] } })
    expect(res.items.map((i) => i.id)).toEqual(['mosaic:MFL-2026-079'])
    expect(res.warnings).toEqual([])
    await repo.search({ ...emptyQuery(), text: 'land cover' })
    expect(log.filter((u) => u.endsWith('manifest.json'))).toHaveLength(1)
  })

  it('gets a resource by id, case-insensitively, and null when unknown', async () => {
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
    expect((await repo.overview()).manifest.counts.resources).toBe(2)
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
