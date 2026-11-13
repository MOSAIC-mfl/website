/**
 * Port: the map. The explorer's logic and components depend on this interface only; MapLibre is one
 * adapter (adapters/maplibre). Layers are MapLibre style objects (the standard the profiles use).
 */
import type { Camera, StyleLayerSpec } from '../domain/config'
import type { LngLat } from '../domain/format'

export interface ScreenPoint {
  x: number
  y: number
}

export interface Padding {
  top: number
  bottom: number
  left: number
  right: number
}

export interface FeatureHit {
  layer: string
  properties: Record<string, unknown>
  at?: ScreenPoint
}

export interface MapClick {
  lngLat: LngLat
  point: ScreenPoint
}

export interface CompareOptions {
  /** map layer ids shown on the right-hand side */
  layers: string[]
  leftLabel: string
  rightLabel: string
  padding: Padding
  restorePitch: number
  onClose: () => void
}

export interface MapEngine {
  /** resolves once the base style is loaded */
  readonly ready: Promise<void>
  addSource(id: string, spec: Record<string, unknown>): void
  /** `lazy`: a hidden PMTiles layer is only added (and its archive opened) the first time it is shown */
  addLayer(spec: StyleLayerSpec, before?: string, lazy?: boolean): void
  hasLayer(id: string): boolean
  setVisible(id: string, visible: boolean): void
  isVisible(id: string): boolean
  setGeoJSON(sourceId: string, data: unknown): void
  /** a MapLibre filter expression on a layer (also before a lazy layer is added) */
  setFilter(id: string, filter: unknown[] | null): void
  /**
   * Features of `layers` under a point, top first; `radius` (px) widens the search to a box around it.
   * `at`: where a point feature is on screen (to pick the nearest one).
   */
  queryAt(point: ScreenPoint, layers: string[], radius?: number): FeatureHit[]
  project(lngLat: LngLat): ScreenPoint
  onClick(handler: (e: MapClick) => void): () => void
  onLayerClick(layer: string, handler: (e: MapClick) => void): () => void
  flyTo(camera: Camera, options?: { duration?: number; padding?: Padding }): void
  jumpTo(camera: Camera): void
  setPadding(padding: Padding, animate?: boolean): void
  containerHeight(): number
  hasTerrain(): boolean
  setTerrainExaggeration(value: number): void
  compare(options: CompareOptions): Promise<void>
  closeCompare(restoreView: boolean): void
  isComparing(): boolean
  destroy(): void
}
