/**
 * Adapter: the static API that mosaic-api exports to GitHub Pages.
 *
 * Reads v1/filters.json, v1/sources.json and the internal index v1/_index/index.json, then the
 * hashed files the index lists (summaries shards, search texts), once per page load. Hashed files
 * never change, so the browser and the CDN can cache them for good. Search and filters then run in
 * the browser (domain/search.ts), with the same rules as the API.
 */
import type { FiltersInfo, LandscapePage, LandscapeSummary, ResourceDetail, ResourceSummary, SourceInfo } from '../api/types'
import { LabelBook, catalogueCounts } from '../domain/labels'
import type { CatalogueQuery } from '../domain/query'
import { search, type SearchResult } from '../domain/search'
import { key } from '../domain/text'
import { ApiError, type JsonFetcher } from './http'
import { rankRelated } from './related'
import type { LandscapeRepository } from './landscapes'
import type { CatalogRepository, CatalogueOverview } from './repository'

interface FileRef {
  path: string
  sha256: string
  records: number
}

/** v1/_index/index.json: internal to the static export, not part of the API contract. */
interface SearchIndex {
  harvested_at: string | null
  summaries: FileRef[]
  search: FileRef
}

interface Index {
  overview: CatalogueOverview
  summaries: ResourceSummary[]
  texts: Record<string, string>
}

const resourcePath = (source: string, localId: string) =>
  `v1/resources/${encodeURIComponent(source)}/${encodeURIComponent(localId)}.json`

export class StaticCatalogRepository implements CatalogRepository, LandscapeRepository {
  private index: Promise<Index> | null = null

  constructor(
    private readonly baseUrl: string,
    private readonly fetchJson: JsonFetcher,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`
  }

  private load(): Promise<Index> {
    this.index ??= (async () => {
      const [info, sources, idx] = await Promise.all([
        this.fetchJson<FiltersInfo>(this.url('v1/filters.json')),
        this.fetchJson<SourceInfo[]>(this.url('v1/sources.json')),
        this.fetchJson<SearchIndex>(this.url('v1/_index/index.json')),
      ])
      const [texts, ...shards] = await Promise.all([
        this.fetchJson<Record<string, string>>(this.url(idx.search.path)),
        ...idx.summaries.map((s) => this.fetchJson<ResourceSummary[]>(this.url(s.path))),
      ])
      const overview = { info, sources, facets: catalogueCounts(info), labels: LabelBook.fromFilters(info) }
      return { overview, summaries: shards.flat(), texts }
    })()
    this.index.catch(() => {
      this.index = null // allow a retry after a network error
    })
    return this.index
  }

  async overview(): Promise<CatalogueOverview> {
    return (await this.load()).overview
  }

  async search(query: CatalogueQuery): Promise<SearchResult> {
    const { summaries, texts, overview } = await this.load()
    const { filters, warnings } = overview.labels.resolve(query.filters)
    return search(summaries, texts, { ...query, filters }, warnings)
  }

  async get(id: string): Promise<ResourceDetail | null> {
    const { summaries } = await this.load()
    // Ids are matched like the API does (case, accents, separators).
    const hit = summaries.find((s) => s.id === id) ?? summaries.find((s) => key(s.id) === key(id))
    if (!hit) return null
    try {
      return await this.fetchJson<ResourceDetail>(this.url(resourcePath(hit.source, hit.local_id)))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }
  }

  recordLink(d: ResourceDetail): string {
    return this.url(resourcePath(d.source, d.local_id))
  }

  async related(detail: ResourceDetail, limit: number): Promise<ResourceSummary[]> {
    return rankRelated(detail, (await this.load()).summaries, limit)
  }

  private landscapeIndex: Promise<LandscapeSummary[]> | null = null

  /** landscape pages only need v1/landscapes.json, not the whole catalogue index */
  async landscapes(): Promise<LandscapeSummary[]> {
    this.landscapeIndex ??= this.fetchJson<LandscapeSummary[]>(this.url('v1/landscapes.json')).catch((err) => {
      this.landscapeIndex = null
      if (err instanceof ApiError && err.status === 404) return [] // an export without landscape pages
      throw err
    })
    return this.landscapeIndex
  }

  async landscape(codeOrSlug: string): Promise<LandscapePage | null> {
    const hit = (await this.landscapes()).find((l) => key(l.code) === key(codeOrSlug))
    if (!hit) return null
    return this.fetchJson<LandscapePage>(this.url(`v1/landscapes/${encodeURIComponent(hit.code)}.json`))
  }
}
