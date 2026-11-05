/**
 * The explorer's module registry: overlay renderers, click inspectors, side panels and chart
 * builders, each looked up by the `kind` a profile names. Core modules are registered here;
 * a profile with needs of its own registers more in its plugin (src/profiles/<code>/), without
 * touching the engine.
 */
import { CORE_CHART_BUILDERS, type ChartBuilder } from '../application/chart-builders'
import type { OverlayConfig } from '../domain/config'
import { Options } from '../domain/options'
import { ATTRIBUTE_INSPECTORS, combined } from '../inspectors/attributes'
import { CORE_INSPECTORS } from '../inspectors/core'
import { CORE_PANELS, type PanelFactory } from '../panels/core'
import { ClimateGridRenderer } from './climate-grid'
import { IndexGridRenderer } from './index-grid'
import { RasterTilesRenderer } from './raster-tiles'
import { StyleLayersRenderer } from './style-layers'
import type { Inspector, InspectorFactory, OverlayRenderer, RendererFactory, RendererServices } from './types'
import { YearTilesRenderer } from './year-tiles'

export class ModuleRegistry {
  private readonly renderers = new Map<string, RendererFactory>()
  private readonly inspectors = new Map<string, InspectorFactory>()
  private readonly panels = new Map<string, PanelFactory>()
  private readonly charts = new Map<string, ChartBuilder>()

  registerRenderer(kind: string, factory: RendererFactory): this {
    this.renderers.set(kind, factory)
    return this
  }

  registerInspector(kind: string, factory: InspectorFactory): this {
    this.inspectors.set(kind, factory)
    return this
  }

  registerPanel(kind: string, factory: PanelFactory): this {
    this.panels.set(kind, factory)
    return this
  }

  registerChart(builder: string, fn: ChartBuilder): this {
    this.charts.set(builder, fn)
    return this
  }

  /** an inspector from its options block ({kind, ...}); null when the kind is unknown */
  inspectorFrom(options: Options, where: string): Inspector | null {
    const kind = options.str('kind')
    const factory = this.inspectors.get(kind)
    if (!factory) {
      console.warn(`explorer: no inspector '${kind}' (${where})`)
      return null
    }
    return factory(options)
  }

  private services: RendererServices = {
    inspector: (config: OverlayConfig) => {
      if (!config.inspect) return null
      const factory = this.inspectors.get(config.inspect.kind)
      if (!factory) {
        console.warn(`explorer: no inspector '${config.inspect.kind}' (overlay ${config.id})`)
        return null
      }
      return factory(new Options(config.inspect, `overlays.${config.id}.inspect`))
    },
  }

  /** null when the kind is unknown: the rail shows the overlay as unavailable */
  renderer(config: OverlayConfig): OverlayRenderer | null {
    const factory = this.renderers.get(config.kind)
    return factory ? factory(config, this.services) : null
  }

  panel(kind: string): PanelFactory | undefined {
    return this.panels.get(kind)
  }

  chart(builder: string): ChartBuilder | undefined {
    return this.charts.get(builder)
  }
}

export function coreRegistry(): ModuleRegistry {
  const r = new ModuleRegistry()
  r.registerRenderer('raster-tiles', (c, s) => new RasterTilesRenderer(c, s) as OverlayRenderer)
  r.registerRenderer('year-tiles', (c, s) => new YearTilesRenderer(c, s) as OverlayRenderer)
  r.registerRenderer('climate-grid', (c, s) => new ClimateGridRenderer(c, s) as OverlayRenderer)
  r.registerRenderer('index-grid', (c, s) => new IndexGridRenderer(c, s) as OverlayRenderer)
  r.registerRenderer('style-layers', (c, s) => new StyleLayersRenderer(c, s) as OverlayRenderer)
  for (const [k, f] of Object.entries({ ...CORE_INSPECTORS, ...ATTRIBUTE_INSPECTORS })) r.registerInspector(k, f)
  r.registerInspector('combined', combined((part) => r.inspectorFrom(part, 'combined inspector part')))
  for (const [k, f] of Object.entries(CORE_PANELS)) r.registerPanel(k, f)
  for (const [k, f] of Object.entries(CORE_CHART_BUILDERS)) r.registerChart(k, f)
  return r
}
