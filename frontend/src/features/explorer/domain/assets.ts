/**
 * Where each data file of an explorer is served from. A profile lists roots (e.g. the author's
 * GitHub Pages and a Hugging Face dataset) and routes (prefix or exact path -> root); everything else
 * goes to the default root. Files whose licence is not cleared are `withheld`: never requested.
 *
 * `override` (development only, PUBLIC_MOSAIC_PROFILE_DATA) serves every file from one local folder,
 * like the explorer's own `?data=local`.
 */
import type { AssetRef, DataConfig, StyleLayerSpec, StyleSourceSpec } from './config'

export const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] } as const

export class AssetRouter {
  constructor(
    private readonly data: DataConfig,
    private readonly override: string | null = null,
  ) {}

  private root(path: string): string {
    if (this.override) return this.override.replace(/\/?$/, '/')
    const route = (this.data.routes ?? []).find((r) =>
      r.prefix ? path.startsWith(r.prefix) : r.path === path,
    )
    return this.data.roots[route?.root ?? this.data.default_root]
  }

  /** never requested, also from a local override (their licence is not cleared) */
  isWithheld(path: string): boolean {
    return (this.data.withheld ?? []).includes(path)
  }

  url(path: string): string {
    if (path.includes('..') || path.startsWith('/')) throw new Error(`invalid asset path: ${path}`)
    return this.root(path) + path.split('/').map(encodeURIComponent).join('/')
  }

  /** pmtiles:// URL with the cache-busting version the profile declares. */
  pmtiles(path: string): string {
    const v = this.data.tiles_version ? `?v=${encodeURIComponent(this.data.tiles_version)}` : ''
    return `pmtiles://${this.url(path)}${v}`
  }

  /** Glyph template: the {fontstack}/{range} braces must survive URL encoding. */
  glyphs(template: string): string {
    return this.root(template) + template
  }

  report(): string | undefined {
    return this.data.report
  }

  private resolveRef(value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const ref = value as Partial<Record<'asset' | 'pmtiles', string>>
      if (typeof ref.pmtiles === 'string') return this.pmtiles(ref.pmtiles)
      if (typeof ref.asset === 'string') return this.isWithheld(ref.asset) ? EMPTY_COLLECTION : this.url(ref.asset)
    }
    return value
  }

  /** A MapLibre source with its {asset}/{pmtiles} references turned into URLs. */
  source(spec: StyleSourceSpec): Record<string, unknown> {
    return Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, k === 'data' || k === 'url' ? this.resolveRef(v) : v]))
  }

  sources(specs: Record<string, StyleSourceSpec>): Record<string, Record<string, unknown>> {
    return Object.fromEntries(Object.entries(specs).map(([id, s]) => [id, this.source(s)]))
  }
}

export const isAssetRef = (v: unknown): v is AssetRef =>
  !!v && typeof v === 'object' && ('asset' in (v as object) || 'pmtiles' in (v as object))

export type { StyleLayerSpec }
