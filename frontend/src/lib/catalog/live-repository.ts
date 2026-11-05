/**
 * Adapter: a running mosaic-api (`python -m mosaic_api serve`). Search and filters run on the
 * server; calls are typed by the generated OpenAPI client (openapi-fetch), so a change in the API
 * contract fails the website's type check.
 */
import createClient from 'openapi-fetch'
import type { paths } from '../api/schema'
import type { FacetCounts, LandscapePage, LandscapeSummary, ResourceDetail, ResourceSummary } from '../api/types'
import { FACETS } from '../domain/facets'
import { LabelBook, catalogueCounts } from '../domain/labels'
import { SORT_TO_API, type CatalogueQuery } from '../domain/query'
import type { SearchResult } from '../domain/search'
import { ApiError } from './http'
import { rankRelated } from './related'
import type { LandscapeRepository } from './landscapes'
import type { CatalogRepository, CatalogueOverview } from './repository'

type Client = ReturnType<typeof createClient<paths>>

export class LiveCatalogRepository implements CatalogRepository, LandscapeRepository {
  private readonly client: Client
  private cachedOverview: Promise<CatalogueOverview> | null = null

  constructor(
    private readonly baseUrl: string,
    fetchImpl?: typeof fetch,
  ) {
    // Network failures (server down, CORS) become ApiError with a readable message, like the static adapter.
    const base = fetchImpl ?? globalThis.fetch.bind(globalThis)
    const guarded: typeof fetch = async (input, init) => {
      try {
        return await base(input, init)
      } catch (err) {
        throw new ApiError(`Could not reach the catalogue at ${baseUrl} (${String(err)})`, null, String(input))
      }
    }
    this.client = createClient<paths>({ baseUrl, fetch: guarded })
  }

  private static unwrap<T>(res: { data?: T; error?: unknown; response: Response }): T {
    if (res.data === undefined) throw new ApiError(`${res.response.status} ${res.response.statusText}`, res.response.status, res.response.url)
    return res.data
  }

  overview(): Promise<CatalogueOverview> {
    this.cachedOverview ??= (async () => {
      const [info, sources] = await Promise.all([
        this.client.GET('/v1/filters').then(LiveCatalogRepository.unwrap),
        this.client.GET('/v1/sources').then(LiveCatalogRepository.unwrap),
      ])
      return { info, sources, facets: catalogueCounts(info), labels: LabelBook.fromFilters(info) }
    })()
    this.cachedOverview.catch(() => {
      this.cachedOverview = null
    })
    return this.cachedOverview
  }

  async search(query: CatalogueQuery): Promise<SearchResult> {
    const { sort, order } = SORT_TO_API[query.sort]
    const filters: Record<string, string> = {}
    // The API takes comma-separated values (OR).
    for (const facet of FACETS) {
      const values = query.filters[facet]
      if (values?.length) filters[facet] = values.join(',')
    }
    const page = LiveCatalogRepository.unwrap(
      await this.client.GET('/v1/resources', {
        params: {
          query: { q: query.text, sort, order, page: query.page, page_size: query.pageSize, include_facets: true, ...filters },
        },
      }),
    )
    return {
      items: page.items,
      total: page.total,
      facets: (page.facets ?? {}) as FacetCounts,
      warnings: page.warnings ?? [],
    }
  }

  async get(id: string): Promise<ResourceDetail | null> {
    const [source, ...rest] = id.split(':')
    const res = await this.client.GET('/v1/resources/{source_id}/{local_id}', {
      params: { path: { source_id: source, local_id: rest.join(':') } },
    })
    if (res.response.status === 404) return null
    return LiveCatalogRepository.unwrap(res) as ResourceDetail
  }

  recordLink(d: ResourceDetail): string {
    return `${this.baseUrl}/v1/resources/${encodeURIComponent(d.source)}/${encodeURIComponent(d.local_id)}`
  }

  async related(detail: ResourceDetail, limit: number): Promise<ResourceSummary[]> {
    // Candidates: same landscape(s) or theme(s), fetched in one page each, ranked locally.
    const ask = async (facet: 'landscape' | 'theme', values: string[]) =>
      values.length
        ? (await this.search({ text: '', filters: { [facet]: values }, sort: 'az', page: 1, pageSize: 50 })).items
        : []
    const themes = detail.facets.theme ?? []
    const [byLandscape, byTheme] = await Promise.all([ask('landscape', detail.landscapes), ask('theme', themes)])
    const unique = new Map([...byLandscape, ...byTheme].map((r) => [r.id, r]))
    return rankRelated(detail, [...unique.values()], limit)
  }

  async landscapes(): Promise<LandscapeSummary[]> {
    return LiveCatalogRepository.unwrap(await this.client.GET('/v1/landscapes'))
  }

  async landscape(codeOrSlug: string): Promise<LandscapePage | null> {
    const res = await this.client.GET('/v1/landscapes/{code}', { params: { path: { code: codeOrSlug } } })
    if (res.response.status === 404) return null
    return LiveCatalogRepository.unwrap(res)
  }
}
