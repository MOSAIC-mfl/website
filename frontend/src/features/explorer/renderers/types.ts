/**
 * Renderers: one per kind of overlay (raster tiles, tiles per year, climate grid, ...). A renderer
 * owns its map layers and turns the view (time, variant) into what is drawn, the legend and the
 * time bar. It never touches the DOM: it returns models the components draw.
 *
 * Open for extension: a new kind of overlay is a new class registered under its `kind`
 * (registry.ts); profiles name the kind in explorer.yaml.
 */
import type { Inspection } from '../domain/blocks'
import type { OverlayConfig } from '../domain/config'
import type { LngLat } from '../domain/format'
import type { LegendModel } from '../domain/legend'
import type { AssetRouter } from '../domain/assets'
import type { DataSource } from '../ports/data'
import type { MapEngine } from '../ports/map-engine'

/** What every module of an explorer can use. */
export interface ExplorerContext {
  engine: MapEngine
  assets: AssetRouter
  data: DataSource
  /** "0.12° S, 34.50° E · Kisumu, Kenya" (admin unit when the admin layer is on) */
  place(lngLat: LngLat): string
  /** objects shared between modules (e.g. one climate grid for several overlays) */
  shared<T>(key: string, make: () => T): T
}

export interface Segment {
  id: string
  label: string
  options: { value: string; label: string; disabled?: boolean; hidden?: boolean }[]
  value: string
  hidden?: boolean
}

/** The time bar: segmented switches, a slider and a caption ("<strong>2020</strong> · annual total"). */
export interface TimeControl {
  segments: Segment[]
  slider: { min: number; max: number; step: number; value: number }
  caption: { strong: string; rest: string }
}

export type TimeInput = { type: 'segment'; id: string; value: string } | { type: 'slider'; value: number }

export interface OverlayView<T> {
  time: T
  variant: string | null
}

export interface OverlayRenderer<T = unknown> {
  readonly config: OverlayConfig
  /** time state shared by renderers with the same key (null: no time dimension) */
  readonly timeKey: string | null
  initialTime(): T
  /** adds the overlay's (hidden) layers to the map */
  register(ctx: ExplorerContext): void
  /** false: the rail shows the item as not available */
  available(ctx: ExplorerContext): Promise<boolean>
  show(ctx: ExplorerContext, view: OverlayView<T>): Promise<void>
  hide(ctx: ExplorerContext): void
  legend(view: OverlayView<T>): LegendModel | null
  timeControl(view: OverlayView<T>): TimeControl | null
  applyTime(time: T, input: TimeInput): T
  /** time from a story chapter, a study card or the URL ({var, season, mode, year, ...}) */
  presetTime(time: T, params: Record<string, string | number>): T
  /** the time as URL parameters */
  timeParams(time: T): Record<string, string>
  inspect(ctx: ExplorerContext, lngLat: LngLat, view: OverlayView<T>): Promise<Inspection | null>
  /** ids of the map layers drawn now (the comparison shows them on the right) */
  layerIds(view: OverlayView<T>): string[]
  /** variant switch (e.g. All / MAM / OND), drawn in the legend */
  variants(): { id: string; label: string }[]
  /** text added to the attribution line */
  attribution(): string | undefined
}

export type RendererFactory = (config: OverlayConfig, services: RendererServices) => OverlayRenderer<unknown>

/** What a renderer receives besides its config: inspectors for clicks. */
export interface RendererServices {
  inspector(config: OverlayConfig): Inspector | null
}

/** A click handler for an overlay, configured by `inspect: {kind: ...}`. */
export interface Inspector {
  inspect(ctx: ExplorerContext, lngLat: LngLat, vars: InspectVars): Promise<Inspection | null>
}

/** The current state of the overlay the click is about (year of a time series, ...). */
export interface InspectVars {
  year?: string
  /** every year of the overlay, in order (a raster with one band per year) */
  years?: string[]
  overlayTitle: string
}

export type InspectorFactory = (options: import('../domain/options').Options) => Inspector
