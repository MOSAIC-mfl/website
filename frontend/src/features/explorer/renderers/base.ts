/** Shared behaviour of renderers without their own time logic. */
import type { Inspection } from '../domain/blocks'
import type { OverlayConfig } from '../domain/config'
import type { LngLat } from '../domain/format'
import type { LegendModel } from '../domain/legend'
import { Options } from '../domain/options'
import type {
  ExplorerContext,
  Inspector,
  OverlayRenderer,
  OverlayView,
  RendererServices,
  TimeControl,
  TimeInput,
} from './types'

export abstract class BaseRenderer<T> implements OverlayRenderer<T> {
  protected readonly o: Options
  protected readonly inspector: Inspector | null

  constructor(
    readonly config: OverlayConfig,
    services: RendererServices,
  ) {
    this.o = new Options(config, `overlays.${config.id}`)
    this.inspector = services.inspector(config)
  }

  abstract readonly timeKey: string | null
  abstract initialTime(): T
  abstract register(ctx: ExplorerContext): void
  abstract show(ctx: ExplorerContext, view: OverlayView<T>): Promise<void>
  abstract hide(ctx: ExplorerContext): void
  abstract legend(view: OverlayView<T>): LegendModel | null
  abstract layerIds(view: OverlayView<T>): string[]

  async available(_ctx: ExplorerContext): Promise<boolean> {
    return true
  }

  timeControl(_view: OverlayView<T>): TimeControl | null {
    return null
  }

  applyTime(time: T, _input: TimeInput): T {
    return time
  }

  presetTime(time: T, _params: Record<string, string | number>): T {
    return time
  }

  timeParams(_time: T): Record<string, string> {
    return {}
  }

  async inspect(ctx: ExplorerContext, lngLat: LngLat, view: OverlayView<T>): Promise<Inspection | null> {
    return this.inspector ? this.inspector.inspect(ctx, lngLat, { ...this.vars(view), overlayTitle: this.config.title }) : null
  }

  protected vars(_view: OverlayView<T>): { year?: string; years?: string[] } {
    return {}
  }

  variants(): { id: string; label: string }[] {
    return []
  }

  attribution(): string | undefined {
    return this.config.attribution
  }

  protected rasterLayer(id: string, source: string): { id: string; type: string; source: string; layout: object; paint: object } {
    return {
      id,
      type: 'raster',
      source,
      layout: { visibility: 'none' },
      paint: (this.config.paint as object) ?? { 'raster-resampling': 'nearest', 'raster-opacity': 0.85 },
    }
  }
}
