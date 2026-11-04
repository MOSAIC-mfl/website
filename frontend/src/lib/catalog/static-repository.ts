/**
 * Adapter: the static API that mosaic-api exports to GitHub Pages.
 *
 * Reads v1/manifest.json first, then the hashed files it lists (summaries shards, search texts),
 * once per page load. Hashed files never change, so the browser and the CDN can cache them for good.
 * Search and filters then run in the browser (domain/search.ts), with the same rules as the API.
 */
import type {
  FacetCounts,
  LandscapePage,
  LandscapeSummary,
  Labels,
  Manifest,
  ResourceDetail,
  ResourceSummary,
  SourceInfo,
} from '../api/types'
import { LabelBook } from '../domain/labels'
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

interface StaticManifest extends Manifest {
  files: {
    sources: string
    facets: string
    labels: string
    summaries: FileRef[]
    search: FileRef
    resource: string
    /** absent in an export made before landscape pages existed */
    landscapes?: string
    landscape?: string
  }
}

interface Index {
  manifest: StaticManifest
  overview: CatalogueOverview
  summaries: ResourceSummary[]
  texts: Record<string, string>
}

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
      const manifest = await this.fetchJson<StaticManifest>(this.url('v1/manifest.json'))
      const f = manifest.files
      const [sources, facets, labels, texts, ...shards] = await Promise.all([
        this.fetchJson<SourceInfo[]>(this.url(f.sources)),
        this.fetchJson<FacetCounts>(this.url(f.facets)),
        this.fetchJson<{ labels: Labels }>(this.url(f.labels)),
        this.fetchJson<Record<string, string>>(this.url(f.search.path)),
        ...f.summaries.map((s) => this.fetchJson<ResourceSummary[]>(this.url(s.path))),
      ])
      const book = new LabelBook(labels.labels, facets)
      return { manifest, overview: { manifest, sources, facets, labels: book }, summaries: shards.flat(), texts }
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
    const { summaries, manifest } = await this.load()
    // Ids are matched like the API does (case, accents, separators).
    const hit = summaries.find((s) => s.id === id) ?? summaries.find((s) => key(s.id) === key(id))
    if (!hit) return null
    const path = manifest.files.resource
      .replace('{source}', encodeURIComponent(hit.source))
      .replace('{local_id}', encodeURIComponent(hit.local_id))
    try {
      return await this.fetchJson<ResourceDetail>(this.url(path))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }
  }

  recordLinks(d: ResourceDetail): { json: string; jsonld: string } {
    const json = this.url(`v1/resources/${encodeURIComponent(d.source)}/${encodeURIComponent(d.local_id)}.json`)
    return { json, jsonld: json.replace(/\.json$/, '.jsonld') }
  }

  async related(detail: ResourceDetail, limit: number): Promise<ResourceSummary[]> {
    return rankRelated(detail, (await this.load()).summaries, limit)
  }

  private manifestOnly: Promise<StaticManifest> | null = null

  /** landscape pages only need the manifest, not the whole catalogue index */
  private manifest(): Promise<StaticManifest> {
    this.manifestOnly ??= this.fetchJson<StaticManifest>(this.url('v1/manifest.json'))
    this.manifestOnly.catch(() => (this.manifestOnly = null))
    return this.manifestOnly
  }

  async landscapes(): Promise<LandscapeSummary[]> {
    const m = await this.manifest()
    return m.files.landscapes ? this.fetchJson<LandscapeSummary[]>(this.url(m.files.landscapes)) : []
  }

  async landscape(codeOrSlug: string): Promise<LandscapePage | null> {
    const m = await this.manifest()
    const hit = (await this.landscapes()).find((l) => key(l.code) === key(codeOrSlug))
    if (!hit || !m.files.landscape) return null
    return this.fetchJson<LandscapePage>(this.url(m.files.landscape.replace('{code}', encodeURIComponent(hit.code))))
  }
}

export type { StaticManifest }
